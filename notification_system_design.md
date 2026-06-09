<h1>STAGE 1</h1>

<ul>

<h3>Core Actions</h3>
<li>Fetch Notifications</li>
<li>Mark as Read</li>
<li>Mark All as Read</li>
<li>Real-time Stream</li>
</ul>

<h3>Rest api endpoints</h3>

response  200 OK

{

  "success": true,

  "data": [

    {
      "id": "notif_01",

      "title": "Order Update",

      "message": "Your order #1024 has been shipped.",

      "category": "status",

      "isRead": false,

      "createdAt": "2026-06-09T11:30:00Z"
    }
  ],

  "pagination": { "total": 1, "page": 1, "pages": 1 }

}

<u><h4>Patch Notification/ Read</h4></u>

Marks a specific list of notification IDs as read.

{

  "notificationIds": ["notif_01"]

}

<u><h4>post Notification/ Read all</h4></u>
to make real all

{

  "success": true,

  "message": "All notifications marked as read."

}


<u><h4>Delete notifications</h4></u>

deletes an specific notification

{

  "success": true,

  "message": "Notification deleted."

}



<h1>STAGE 2</h1>

<h3>Database Selected - NoSQL (MongoDB)</h3>

<ul>
<h4>WHY?</h4>
<li>MongoDB's document structure handles polymorphic metadata objects natively without requiring sparse columns or expensive SQL joins.</li>
<li>Notification systems are heavy on write operations. MongoDB utilizes memory-mapped files and flexible locking, allowing it to ingest massive bursts of concurrent incoming alerts seamlessly.</li>
<li>Notifications accumulate rapidly. MongoDB's native sharding lets us partition data horizontally across multiple servers using a shard key (like userId).</li>

</ul>

<h3>Databse Schema</h3>

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({

  userId: {

    type: String,

    required: true,

  },

  title: {

    type: String,
    required: true,
    trim: true

  },

  message: {

    type: String,
    required: true
  },

  category: {

    type: String,
    required: true,
    enum: ['status', 'billing', 'system_alert', 'marketing']
  },

  isRead: {

    type: Boolean,
    default: false,
    required: true,
    unread counts
  },

  metadata: {

    type: Map,
    of: mongoose.Schema.Types.Mixed, 
    default: {}
  }

}, {

  timestamps: true 

});


NotificationSchema.index(
    {
         userId: 1, isRead: 1, createdAt: -1 
         });

module.exports = mongoose.model('Notification', NotificationSchema);


<ul>
<h3>Problems</h3>

<li>As time goes on, older notifications start piling up. Accumulating terabytes of unneeded data bloats the system's memory, which slows down search indexes and makes the whole platform feel slow.</li>

<li>Querying unread notification counts on every page load across millions of active users strains database CPU.</li>
</ul>


<h3>Fetch user notifications</h3>

const { userId } = req.user; 

const { status, page = 1, limit = 20 } = req.query;

const query = { userId };

if (status === 'unread') query.isRead = false;

if (status === 'read') query.isRead = true;

const notifications = await Notification.find(query)

  .sort({ createdAt: -1 }) 
  
  .skip((page - 1) * limit)

  .limit(Number(limit))

  .lean();



<h3>Mark Notifications as Read</h3>

const { userId } = req.user;
const { notificationIds } = req.body; 

const result = await Notification.updateMany(

  { 

    _id: { $in: notificationIds }, 
    userId: userId
  },

  {
     $set: { isRead: true } 
    }
);


<h3>Mark all Notifications as Read</h3>


const { userId } = req.user;

const result = await Notification.updateMany(

  { userId: userId, isRead: false },

  { $set: { isRead: true } 
  
  }

);


<h3>Delete Notification</h3>

const { userId } = req.user;

const { id } = req.params;

const result = await Notification.deleteOne({

  _id: id,
  userId: userId 

});



<h1>STAGE 3</h1>

YES, THE QUERRY IS FUNCTIONALLY CORRECT

It is slow because it triggers a Full Table Scan. Without an index, the database must look through all 5,000,000 rows to find student 1042.

<h3>THE FIX</h3>

Create a single Compound Index:

CREATE INDEX idx_student_unread_date 

ON notifications (studentID, isRead, createdAt ASC);

<h3>Computational cost</h3>

the drops from O(n) to O(log n), The index pre-sorts the data, completely eliminating the sorting cost.

<h3>Is Indexing every column is effective </h3>

No. It is highly inefficient because:

Slows down writes:- Every INSERT or UPDATE forces the database to re-write every single index tree.

Bloats storage:- Indexes eat up RAM and disk space, eventually crowding out the database memory.

Fails multi-column queries:- The database can rarely combine separate single-column indexes efficiently for a single query.


<h2>Placement Query</h2>

SELECT DISTINCT studentID

FROM notifications

WHERE notificationType = 'Placement'

  AND createdAt >= NOW() - INTERVAL '7 days';



<h1>STAGE 4</h1>

<ul>
To stop repetitive page loads from crashing the primary database, we use two main strategies:

<li>In-Memory Caching (Redis): Stores the unread notifications or badge counts in memory so lookups take less than a millisecond without hitting the main DB.</li>


<li>State Preservation: The client fetches notifications once when the app boots up and uses real-time streams (SSE) to push updates, rather than re-fetching on every page click.</li>

</ul>


<h1>Current Implementation</h1>

<ul>

The current code implements a synchronous loop running on the main request thread, which causes several issues:

<li>
Blocking Execution & Timeouts :-   Making network requests (send_email, save_db, push_to_app) inside a synchronous loop for 50,000 students will cause the HR’s browser request to time out.
</li>
<li>
Single Point of Failure :- If the third-party email API throws an error midway (as the logs showed for 200 students), the loop terminates abruptly. The remaining students never receive their notifications, and the system has no record of who was missed.
</li>
<li>
Database Connection Pool Exhaustion :- Bombarding the primary database with 50,000 standalone sequential inserts in a tight loop risks freezing the application or choking available connection pools.
</li>
</ul>


<h3>Design Recommendation Strategy</h3>

<ul>
    <li>
    To make this mechanism reliable and fast, we must decouple the core task by moving it to an Asynchronous Message Queue / Worker System.
    </li>
    
    Separation of Concerns: Database vs. Email
No, saving to the DB and sending the email should absolutely not happen together on the same thread. * Writing to the database is an internal transaction.



</ul>


<h3>New architecture</h3>

<ul>

<li>The Request Trigger: When the HR hits "Notify All", the backend immediately creates a parent transaction record in the database.</li>

<li>Enqueueing: The backend publishes a single lightweight bulk notification event task to a message broker queue and instantly returns a 202 Accepted status to the HR's UI. The frontend is freed instantly.</li>

<li>Worker Processing: Dedicated background worker threads poll the queue, split the massive 50,000 student array into manageable batch chunks (e.g., chunks of 500), and execute operations in parallel.</li>

<li>Resilience: If an email fails for 200 students, only those specific failed individual worker jobs are caught and sent to a Retry Queue with exponential backoff, without crashing the broader system.</li>
</ul>


# Stage 6

## 1. Sorting Strategy
Priority is managed via a two-tier comparison scheme:
* **Primary (Weight):** `Placement` (3) > `Result` (2) > `Event` (1).
* **Secondary (Recency):** Newest `Timestamp` breaks ties when weights match.

## 2. Real-time Optimization at Scale
Continuously sorting an array every time a live event arrives costs $O(N \log N)$, which stalls the main JavaScript event loop as data sizes expand.

**The Fix:**
* Maintain a **Min-Heap (Priority Queue)** capped strictly at a fixed size of 10 elements.
* When a new alert streams in, check if its priority beats the minimum item at the root of the heap. If yes, drop the root and insert the new item ($O(\log 10)$). 
* This leaves runtime bounded to an ultra-fast **$O(1)$ constant overhead processing window**, preventing incoming memory spikes.


<h3>the code in priorityInbox.js file and output screenshot in screenshot.png file</h3>


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
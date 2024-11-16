# Minecraft Bedrock Chat Logger

NodeJs project that connects to a Minecraft Bedrock server as a local headless player to monitor and log chat and player events.



## How to start
The server must have `online-mode=false` in `server.properties` (affects LAN only)

1) Install latest Node.js
2) Browse to the folder with `mc-bedrock-chatlog.js`
3) Run the following commands:
   
> ```npm i```

> ```node ./mc-bedrock-chatlog.js -h 10.0.0.5 -p 19132```

The bot will connect to the server and start logging chat messages to default folder `./logs`.

## All options:
```
-h, --host        Client address
-p, --port        Client port (default 19132)
-u, --username    Bot username (default 'Server')
-l, --logFolder   Log folder (default './logs')
-x, --prefix      Log file prefix (default 'chat-')
-r, --retry       Keep retrying to connect on error (default true)
-i, --interval    Retry interval in seconds (default 30)
--raw             Log raw packets as JSON (default false)
```


## Minor annoyance:
Anonymous LAN users are not persistent and can't be OPed.
The bot is immortal, immovable and doesn't attract creepers,
but will be visible in game on spawn.
The workaround is to switch it to spectator mode every time after connecting.

`/gamemode spectator Server`


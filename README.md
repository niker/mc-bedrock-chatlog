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
--motd            Send a whisper to players when they join
--motdAlone       Send additional whisper to players when they join and no other players are online
```

## Minor annoyance:
Anonymous LAN users are not persistent and can't be OPed.
The bot is immortal, immovable and doesn't attract creepers,
but will be visible in game on spawn.
The workaround is to switch it to spectator mode every time after connecting.

`/gamemode spectator Server`

## Log example
```
(7:10:08) Connecting to 127.0.0.1:19132 as [Server]...
(7:10:08) Connected.
(7:10:58) [Player1] hello
(7:19:01) * [Player1] fell to their death.
(7:21:23) * Players are skipping the night.
(7:28:56) * [Player1] was burnt to a crisp whilst fighting.
(7:36:18) * Players are skipping the night.
(7:57:20) * [Player1] left the game.
(8:41:11) * [Player2] joined the game.
```

## Docker deployment
Not automated yet, but here is a quick guide assuming you have the latest Docker installed on the machine:

1) Pick a directory where the app will live
2) Create a file called docker-compose.yml and paste the following content.

> Make sure to replace `-h minecraft-bedrock` with minecraft docker container name 
> or the correct server IP and make adjustments to the program arguments as needed.

```
services:
  node-app:
    image: node:latest
    container_name: minecraft-bedrock-chatbot
    working_dir: /usr/src/app
    volumes:
      - ./mc-bedrock-chatlog:/usr/src/app
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
    command: ["sh", "-c", "apt-get update && apt-get install -y cmake && npm install && node mc-bedrock-chatlog.js -h minecraft-bedrock"]
    stdin_open: true # Keep the container running
    tty: true        # Allocate a pseudo-TTY for the container
    environment:
      - TZ=Europe/Prague
      - LANG=cs_CZ.UTF-8
      - LC_ALL=cs_CZ.UTF-8
    restart: unless-stopped
```
> You may want to edit the timezone and locale to your country. Timezone will correctly offset time from UTC and locale will change 12/24h clock. If you remove the environment section completely, time will be in UTC.

> The containers should also be in the same virtual network. If you have a fixed network for minecraft, you can connect to it by name like this:
```
    networks:
      - internet
      
networks:
    internet:
        external: true
        name: "internet"
```
> The network should have internet access, so the bot can download the required node packages.

4) Git Clone or download this repository here (the process will create mc-bedrock-chatlog subdirectory)
5) Run `docker compose up -d` from the main directory.
6) Your logs should be in the `mc-bedrock-chatlog/logs` directory.

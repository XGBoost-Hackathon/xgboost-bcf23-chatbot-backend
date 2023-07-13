import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from 'dotenv'
import { Server } from 'socket.io'
import http from 'http'
import fs from 'fs'
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer'
import getResponse from './friendgpt.js'
import Tesseract from 'tesseract.js'

config();

const app = express();
const server = http.createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Preserve the original filename
  }
});

const upload = multer({ storage });
const connectedSockets = [];
const sessionMessages = [];

io.on("connection", (socket) => {
  const { username } = socket.handshake.query;

  if(connectedSockets.find((prevsocket) => prevsocket.username === username&&prevsocket.connected)){
    console.log("duplicate");
    socket.emit("username_taken", username);
    socket.disconnect();
    return;
  }
  socket.username = username;
  console.log(`User Connected: ${username}: ${socket.id}`);
  connectedSockets.push(socket);
  socket.emit("connected",username);
  socket.on("send_message", (data) => {
    // data.message = data.message.replace("\n",'<br/>');
    sessionMessages.push(data)
    socket.broadcast.emit("broadcast_message", data);
  });

  socket.on("send_ping", (data) => {
    // data.message = data.message.replace("\n",'<br/>');
    // sessionMessages.push(data)
    console.log(data);
    const recipientSocket = connectedSockets.find(
      (socket) => socket.username === data.otherperson
    );
    recipientSocket.emit("receive_ping", data);
  });

  socket.on("send_message_to_specific", async (data) => {
    // data.message = data.message.replace("\n",'<br/>');
    // sessionMessages.push(data)
    // socket.emit("broadcast_message", data);
    // const { recipient, message } = data;

    if(data.otherperson==='gpt'){
      data.id += 1
      data.username = 'Megh'
      const msg = await getResponse(socket, data)
      
      // socket.emit("sent_to_me_message", data);
    }
    
    const recipientSocket = connectedSockets.find(
      (socket) => socket.username === data.otherperson
    );
    // console.log(recipientSocket.username);
    if (recipientSocket) {
      recipientSocket.emit("sent_to_me_message", data);
    }
  });

  // socket.on("send_message_to_friendgpt", async (data) => {
  //   console.log(data);
  //   data.username = 'Friend Gpt'
  //   const msg = await getResponse(data.message)
  //   data.message = "MOR"
  //   data.id = data.id + 1
  //   socket.emit("sent_to_me_from_gpt", (data))
  // });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
    const socketIndex = connectedSockets.indexOf(socket);
    if (socketIndex !== -1) {
      connectedSockets.splice(socketIndex, 1);
    }
    console.log(connectedSockets.length);
  });
});


function disconnectAllSockets() {
  connectedSockets.forEach((socket) => {
    socket.disconnect(true);
  });
  connectedSockets.length = 0;
}

app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', filename);
  res.download(filePath, (err) => {
    if (err) {
      // Handle any error that occurred during file download
      console.error(err);
      res.status(500).send('Error downloading file');
    }
  });
});

app.get('/actives',(req, res)=>{
  res.send({sockets:connectedSockets.map(connectedSocket=>{
    return {
      username: connectedSocket.username,
      ipv4: connectedSocket.request.connection.remoteAddress
    }
  })
})
})

app.get('/session-messages',(req, res)=>{
  res.send({
    sessionMessages
  })
})

app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', filename);

  // Check if the file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.status(404).json({ message: 'File not found' });
    } else {
      // Set the appropriate headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the file to the response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  });
});

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;

  // Process the uploaded file (e.g., save it to a specific location, perform further operations)
  // const downloadUrl = `${req.protocol}://${req.get('host')}/download/${file.filename}`;
  res.json({ downloadUrl: `/download/${file.filename}` });
});

app.post('/uploadtogpt', upload.single('file'), async (req, res) => {
  const file = req.file;
  const filePath = `uploads\\${file.filename}`
  let recognizedText = '';

  if (filePath.endsWith('.txt')) {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error:', err);
      }
      console.log();
      res.json({ recognizedText: data });
    });
  }
  else{
    await Tesseract.recognize(
      filePath,
      'eng',
      { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
      console.log(text);
      recognizedText = text;
      res.json({ recognizedText: recognizedText });
    })
  }


  // Process the uploaded file (e.g., save it to a specific location, perform further operations)
  // const downloadUrl = `${req.protocol}://${req.get('host')}/download/${file.filename}`;
  
});

server.listen(process.env.PORT, () => {
  console.log(`Server started, listening on port ${process.env.PORT}`);
  disconnectAllSockets();
});

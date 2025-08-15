const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac'
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

app.post('/process-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Processing audio file:', req.file.originalname);
    
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(req.file.originalname);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const audioPart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType,
      },
    };
    
    const prompt = 'Generate a transcript of the provided audio file.';

    console.log('Sending audio to Gemini for transcription...');

    const transcriptionResult = await model.generateContent([prompt, audioPart]);
    const transcript = transcriptionResult.response.text();
    console.log('Transcription generated');

    console.log('Generating summary from actual transcript...');
    const summaryResult = await model.generateContent([
      'Please create a concise summary and bullet point, just like taking notes, of the following transcript, highlighting the main points and key information:\n\n' + transcript
    ]);
    const summary = summaryResult.response.text();
    console.log('Summary generated');
    
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    res.json({
      transcript: transcript,
      summary: summary,
      success: true,
      note: 'Transcription and summary generated successfully using Gemini API.'
    });
    
  } catch (error) {
    console.error('Processing error:', error);
    
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }
    
    res.status(500).json({
      error: 'Failed to process audio: ' + error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`RecNote backend running on port ${port}`);
});

module.exports = app;

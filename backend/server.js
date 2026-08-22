import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`ResolveAI backend server is running on port ${PORT}`);
});

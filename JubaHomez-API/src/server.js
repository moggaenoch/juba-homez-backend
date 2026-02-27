// server.js
const app = require("./app");
const env = require("./config/env");

const PORT = process.env.PORT || env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

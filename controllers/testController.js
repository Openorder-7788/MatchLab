const path = require("path");
const fs = require("fs");

const KEY_FILE = path.join(__dirname, "..", "validation-key.txt");

function handleValidationKey() {
  try {
    const content = fs.readFileSync(KEY_FILE, "utf8").trim();
    return { status: 200, data: content };
  } catch {
    return { status: 404, data: "validation-key.txt not found" };
  }
}

module.exports = { handleValidationKey };

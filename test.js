import { execSync } from "child_process";

const result = execSync('yt-dlp -j https://www.youtube.com/watch?v=dQw4w9WgXcQ');
const json = JSON.parse(result.toString());

console.log(Object.keys(json)); // Semua field yang bisa digunakan dalam template

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import os from "os";

const rootDesign = (req: Request, res: Response) => {
  const uptime = os.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const loadAverage = os.loadavg()[0];
  const totalMem = os.totalmem() / (1024 * 1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024 * 1024);
  const usedMem = totalMem - freeMem;

  const systemTime = new Date().toLocaleString();

  res.status(StatusCodes.OK).send(`
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Raza-HomeQuote</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @keyframes glow {
        0%, 100% { text-shadow: 0 0 10px #00f6ff, 0 0 20px #00f6ff; }
        50% { text-shadow: 0 0 20px #00ffcc, 0 0 40px #00ffcc; }
      }
      @keyframes flicker {
        0% { opacity: 1; }
        45% { opacity: 0.8; }
        50% { opacity: 0.3; }
        55% { opacity: 0.8; }
        100% { opacity: 1; }
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 10px #00ff9d, 0 0 20px #00ff9d; }
        50% { box-shadow: 0 0 30px #00ff9d, 0 0 60px #00ff9d; }
        100% { box-shadow: 0 0 10px #00ff9d, 0 0 20px #00ff9d; }
      }
      @keyframes backgroundMove {
        0% { background-position: 0 0; }
        100% { background-position: 1000px 1000px; }
      }

      body {
        margin: 0;
        font-family: "Orbitron", "Courier New", monospace;
        background: radial-gradient(circle at top left, #0a0f1c, #000);
        background-size: 2000px 2000px;
        animation: backgroundMove 30s linear infinite;
        color: #0ff;
        overflow-x: hidden;
      }
      h1 {
        text-align: center;
        font-size: 2.8rem;
        margin-top: 40px;
        color: #00f6ff;
        animation: glow 2s infinite alternate;
      }
      .sub {
        text-align: center;
        color: #66ffff;
        margin-bottom: 30px;
        font-size: 1rem;
        animation: flicker 4s infinite;
      }
      .panel {
        max-width: 850px;
        margin: auto;
        padding: 25px;
        background: rgba(0, 20, 40, 0.85);
        border: 2px solid #00f6ff;
        border-radius: 12px;
        box-shadow: 0 0 25px rgba(0, 246, 255, 0.5);
        animation: flicker 6s infinite;
      }
      .status {
        text-align: center;
        padding: 15px;
        margin-bottom: 25px;
        font-weight: bold;
        color: #00ff9d;
        font-size: 1.2rem;
        border: 1px solid #00ff9d;
        border-radius: 8px;
        animation: pulse 2s infinite;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      .card {
        background: #101a2c;
        border: 1px solid #00f6ff;
        border-radius: 8px;
        padding: 15px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 0 20px #00f6ff;
      }
      .label {
        font-size: 0.9rem;
        color: #66ffff;
        margin-bottom: 5px;
      }
      .value {
        font-size: 1.2rem;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 0 10px #00f6ff;
      }
    </style>
  </head>
  <body>
    <h1>🐺 WELCOME to COUNTA SERVER 🐺</h1>
    <p class="sub">SYSTEM STATUS MONITOR :: ONLINE</p>

    <div class="panel">
      <div class="status">SERVER STATUS: OPERATIONAL</div>
      <div class="grid">
        <div class="card">
          <div class="label">⏰ SYSTEM TIME</div>
          <div id="systemTime" class="value">${systemTime}</div>
        </div>
        <div class="card">
          <div class="label">🔄 UPTIME</div>
          <div id="uptime" class="value">${hours}h ${minutes}m ${seconds}s</div>
        </div>
        <div class="card">
          <div class="label">🖥️ CPU LOAD</div>
          <div id="cpu" class="value">${loadAverage.toFixed(2)}%</div>
        </div>
        <div class="card">
          <div class="label">💾 MEMORY USAGE</div>
          <div id="memory" class="value">${usedMem.toFixed(1)} GB / ${totalMem.toFixed(1)} GB</div>
        </div>
      </div>
    </div>

    <script>
      // uptime counter
      let uptimeSeconds = ${uptime};
      function updateUptime() {
        uptimeSeconds++;
        const h = Math.floor(uptimeSeconds / 3600);
        const m = Math.floor((uptimeSeconds % 3600) / 60);
        const s = Math.floor(uptimeSeconds % 60);
        document.getElementById("uptime").innerText = h + "h " + m + "m " + s + "s";
      }

      // live system time
      function updateSystemTime() {
        const now = new Date();
        document.getElementById("systemTime").innerText = now.toLocaleString();
      }

      setInterval(updateUptime, 1000);
      setInterval(updateSystemTime, 1000);

      // fetch CPU + Memory every 5s
      async function fetchStatus() {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          document.getElementById("cpu").innerText = data.cpu.toFixed(2) + "%";
          document.getElementById("memory").innerText =
            data.usedMem.toFixed(1) + " GB / " + data.totalMem.toFixed(1) + " GB";
        } catch (err) {
          console.error("Failed to fetch status", err);
        }
      }
      setInterval(fetchStatus, 5000);
    </script>
  </body>
  </html>
  `);
};

// new endpoint for AJAX polling
export const statusApi = (req: Request, res: Response) => {
  const loadAverage = os.loadavg()[0];
  const totalMem = os.totalmem() / (1024 * 1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024 * 1024);
  const usedMem = totalMem - freeMem;

  res.json({
    cpu: loadAverage,
    totalMem,
    usedMem
  });
};

export default rootDesign;

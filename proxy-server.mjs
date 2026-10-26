import http from 'http';
import net from 'net';
import url from 'url';

const PORT = 8899;
const HOST = '127.0.0.1';

/**
 * SeguranApp Smart Local Proxy Runner
 * Intercepta e tunela requisições HTTP e HTTPS do navegador com proteção contra falhas e bloqueios.
 */

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.path,
      method: req.method,
      headers: { ...req.headers },
    };

    delete options.headers['proxy-connection'];

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('SeguranApp Proxy Gateway Error: ' + err.message);
    });

    req.pipe(proxyReq);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Proxy Error');
  }
});

// Tunelamento HTTPS via CONNECT
server.on('connect', (req, clientSocket, head) => {
  const [targetHost, targetPortStr] = req.url.split(':');
  const targetPort = parseInt(targetPortStr, 10) || 443;

  const serverSocket = net.connect(targetPort, targetHost, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length > 0) {
      serverSocket.write(head);
    }
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', () => {
    clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
  });

  clientSocket.on('error', () => {
    serverSocket.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[SeguranApp Proxy] Online e pronto em http://${HOST}:${PORT}`);
});

import jwt from 'jsonwebtoken';
import http from 'http';

const token = jwt.sign({ id: 1, email: 'admin@shadow.com', role: 'ADMIN', name: 'System Admin' }, 'shadow-apollo-secret', { expiresIn: '24h' });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/products/1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Data:', data));
});

req.on('error', e => console.error('Error:', e.message));
req.end();

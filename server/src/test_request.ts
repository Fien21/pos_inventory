import http from 'http';

function makeRequest() {
  console.log('Sending request to server...');
  http.get('http://localhost:5174/api/settings', (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers));
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        console.log('BODY:', rawData);
      } catch (e: any) {
        console.error(e.message);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
  });
}

makeRequest();




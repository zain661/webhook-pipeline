import express from 'express';

const app = express();
app.use(express.json());

app.post('/coordination', (req, res) => {
  console.log('\n🏥 COORDINATION HQ received:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.post('/logistics', (req, res) => {
  console.log('\n🚛 LOGISTICS TEAM received:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.post('/donors', (req, res) => {
  console.log('\n💰 DONOR NETWORK received:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.post('/emergency', (req, res) => {
  console.log('\n🚨 EMERGENCY RESPONSE received:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.listen(3001, () => {
  console.log('🌍 Humanitarian Mock Subscribers running on port 3001');
  console.log('   /coordination → Coordination HQ');
  console.log('   /logistics    → Logistics Team');
  console.log('   /donors       → Donor Network');
  console.log('   /emergency    → Emergency Response');
});

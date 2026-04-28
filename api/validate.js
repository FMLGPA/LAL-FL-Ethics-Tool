export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body;

  if (!token || token.length < 10) {
    return res.status(400).json({ valid: false, error: 'Invalid token.' });
  }

  // Look up token in Airtable
  const filter = encodeURIComponent(`({Token}="${token}")`);
  const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Registrations?filterByFormula=${filter}`;

  const airtableRes = await fetch(airtableUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
    }
  });

  if (!airtableRes.ok) {
    return res.status(500).json({ valid: false, error: 'Validation service unavailable.' });
  }

  const data = await airtableRes.json();

  if (!data.records || data.records.length === 0) {
    return res.status(200).json({ valid: false, error: 'Access link not recognized. Please register.' });
  }

  const record = data.records[0];
  const user = record.fields;

  // Update LastAccess and AccessCount in Airtable
  const updateUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Registrations/${record.id}`;
  await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        LastAccess: new Date().toISOString(),
        AccessCount: (user.AccessCount || 0) + 1
      }
    })
  });

  return res.status(200).json({
    valid: true,
    name: user.Name,
    barNumber: user.BarNumber,
    email: user.Email
  });
}

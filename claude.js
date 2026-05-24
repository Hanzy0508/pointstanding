export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {

    // API KEY GEMINI
    const apiKey = "ISI_API_KEY_GEMINI_LU";

    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        error: 'Image kosong'
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `
Baca hasil pertandingan Free Fire dari gambar ini.

Ambil:
- Nama team
- Kill
- Posisi

Balas JSON saja.

Format:
[
 {
   "team":"EVOS",
   "kill":12,
   "position":1
 }
]
`
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      text
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }
}

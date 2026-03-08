function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDashboard() {
    const airports = document.getElementById("airportInput").value
        .split(",")
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);

    const includeMetar = document.getElementById("includeMetar").checked;
    const output = document.getElementById("output");
    output.innerHTML = "Loading...";

    let html = "";

    for (const airport of airports) {
        // small delay to avoid proxy / upstream throttling
        await sleep(300);

        html += `<div class="airport-block"><div class="title">${airport}</div>`;

        // -------------------------
        // RAW TAF (via AllOrigins)
        // -------------------------
        const tafUrl =
            `https://api.allorigins.win/raw?url=` +
            encodeURIComponent(`https://aviationweather.gov/api/data/taf?ids=${airport}`);

        try {
            const tafResponse = await fetch(tafUrl);
            const tafText = await tafResponse.text();

            if (!tafText || tafText.trim().length === 0) {
                html += `<p>No TAF data available.</p>`;
            } else {
                html += `<b>TAF:</b><br><pre>${tafText.trim()}</pre>`;
            }
        } catch (err) {
            html += `<p>Error loading TAF data.</p>`;
        }

        // -------------------------
        // RAW METAR (via AllOrigins, optional)
        // -------------------------
        if (includeMetar) {
            const metarUrl =
                `https://api.allorigins.win/raw?url=` +
                encodeURIComponent(`https://aviationweather.gov/api/data/metar?ids=${airport}`);

            try {
                const metarResponse = await fetch(metarUrl);
                const metarText = await metarResponse.text();

                if (!metarText || metarText.trim().length === 0) {
                    html += `<p>No METAR data available.</p>`;
                } else {
                    html += `<b>METAR:</b><br><pre>${metarText.trim()}</pre>`;
                }
            } catch (err) {
                html += `<p>Error loading METAR data.</p>`;
            }
        }

        html += `</div>`; // close airport block
    }

    output.innerHTML = html || "No airports specified.";
}

async function runDashboard() {
    const airports = document.getElementById("airportInput").value
        .split(",")
        .map(a => a.trim().toUpperCase());

    const includeMetar = document.getElementById("includeMetar").checked;
    const output = document.getElementById("output");
    output.innerHTML = "Loading...";

    let html = "";

    for (const airport of airports) {
        html += `<div class="airport-block"><div class="title">${airport}</div>`;

        // -------------------------
        // FETCH RAW TAF TEXT
        // -------------------------
        const tafUrl =
            `https://corsproxy.io/?https://aviationweather.gov/api/data/taf?ids=${airport}`;

        try {
            const tafResponse = await fetch(tafUrl);
            const tafText = await tafResponse.text();

            if (!tafText || tafText.trim().length === 0) {
                html += `<p>No TAF data available.</p>`;
            } else {
                html += `<b>TAF:</b><br><pre>${tafText}</pre>`;
            }
        } catch (err) {
            html += `<p>Error loading TAF data.</p>`;
        }

        // -------------------------
        // FETCH RAW METAR TEXT (optional)
        // -------------------------
        if (includeMetar) {
            const metarUrl =
                `https://corsproxy.io/?https://aviationweather.gov/api/data/metar?ids=${airport}`;

            try {
                const metarResponse = await fetch(metarUrl);
                const metarText = await metarResponse.text();

                if (!metarText || metarText.trim().length === 0) {
                    html += `<p>No METAR data available.</p>`;
                } else {
                    html += `<b>METAR:</b><br><pre>${metarText}</pre>`;
                }
            } catch (err) {
                html += `<p>Error loading METAR data.</p>`;
            }
        }

        html += `</div>`; // close airport block
    }

    // After processing all airports, write final HTML
    output.innerHTML = html;
}

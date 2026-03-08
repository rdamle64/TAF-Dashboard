function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper
async function fetchWithRetry(url) {
    try {
        return await fetch(url);
    } catch (err) {
        await sleep(400);
        return await fetch(url);
    }
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

    // ----------------------------------------------------
    // PROXY WARM-UP: Fixes “first request always times out”
    // ----------------------------------------------------
    try {
        await fetchWithRetry(
            "https://api.allorigins.win/raw?url=" +
            encodeURIComponent("https://aviationweather.gov/api/data/taf?ids=KJFK")
        );
        await sleep(300); // give proxy time to cache upstream
    } catch (err) {
        // warm-up failure is harmless
    }

    // ----------------------------------------------------
    // MAIN LOOP
    // ----------------------------------------------------
    for (const airport of airports) {

        // Prevent proxy throttling
        await sleep(300);

        html += `<div class="airport-block"><div class="title">${airport}</div>`;

        // -------------------------
        // RAW TAF
        // -------------------------
        const tafUrl =
            `https://api.allorigins.win/raw?url=` +
            encodeURIComponent(`https://aviationweather.gov/api/data/taf?ids=${airport}`);

        try {
            const tafResponse = await fetchWithRetry(tafUrl);
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
        // RAW METAR
        // -------------------------
        if (includeMetar) {
            const metarUrl =
                `https://api.allorigins.win/raw?url=` +
                encodeURIComponent(`https://aviationweather.gov/api/data/metar?ids=${airport}`);

            try {
                const metarResponse = await fetchWithRetry(metarUrl);
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

        html += `</div>`;
    }

    output.innerHTML = html || "No airports specified.";
}

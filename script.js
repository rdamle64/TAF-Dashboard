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
        // FETCH TAF
        // -------------------------
        const tafUrl = `https://corsproxy.io/?https://aviationweather.gov/api/data/taf?ids=${airport}&format=json`;

        try {
            const tafResponse = await fetch(tafUrl);
            const tafRaw = await tafResponse.json();
            const tafData = tafRaw.data;   // unwrap proxy payload

            // Safety check: TAF array must exist and have at least one entry
            if (!Array.isArray(tafData) || tafData.length === 0) {
                html += `<p>No TAF data available.</p>`;
                html += `</div>`;
                continue;
            }

            const taf = tafData[0];

            // Safety check: forecast must exist and be an array
            if (!taf || !Array.isArray(taf.forecast)) {
                html += `<p>No TAF forecast available.</p>`;
                html += `</div>`;
                continue;
            }

            html += `<b>Issued:</b> ${taf.issue_time}<br>`;
            html += `<b>Valid:</b> ${taf.valid_time_from} → ${taf.valid_time_to}<br><br>`;

            taf.forecast.forEach((period, idx) => {
                html += `<b>Period ${idx + 1}:</b><br>`;
                html += `&nbsp;&nbsp;<b>From:</b> ${period.fcst_time_from}<br>`;
                html += `&nbsp;&nbsp;<b>To:</b> ${period.fcst_time_to}<br>`;
                if (period.wind_speed_kt !== undefined) {
                    html += `&nbsp;&nbsp;<b>Wind:</b> ${period.wind_dir_degrees}° @ ${period.wind_speed_kt} kt<br>`;
                }
                if (period.visibility_statute_mi !== undefined) {
                    html += `&nbsp;&nbsp;<b>Visibility:</b> ${period.visibility_statute_mi} sm<br>`;
                }
                if (period.wx_string) {
                    html += `&nbsp;&nbsp;<b>Weather:</b> ${period.wx_string}<br>`;
                }
                html += `<br>`;
            });

        } catch (err) {
            html += `<p>Error loading TAF data.</p>`;
            html += `</div>`;
            continue;
        }

        // -------------------------
        // FETCH METAR (optional)
        // -------------------------
        if (includeMetar) {
            const metarUrl = `https://corsproxy.io/?https://aviationweather.gov/api/data/metar?ids=${airport}&format=json`;

            try {
                const metarResponse = await fetch(metarUrl);
                const metarRaw = await metarResponse.json();
                const metarData = metarRaw.data;   // unwrap proxy payload

                // Safety check: METAR array must exist and have at least one entry
                if (!Array.isArray(metarData) || metarData.length === 0) {
                    html += `<p>No METAR data available.</p>`;
                    html += `</div>`;
                    continue;
                }

                const metar = metarData[0];
                html += `<b>METAR:</b> ${metar.raw_text}<br>`;

            } catch (err) {
                html += `<p>Error loading METAR data.</p>`;
                html += `</div>`;
                continue;
            }
        }

        html += `</div>`; // close airport block
    }

    // After processing all airports, write final HTML
    output.innerHTML = html;
}

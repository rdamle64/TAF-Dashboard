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

        // Fetch TAF
        const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${airport}&format=json`;
        const tafResponse = await fetch(tafUrl);
        const tafData = await tafResponse.json();

        if (tafData.length === 0) {
            html += "No TAF available.<br>";
        } else {
            const taf = tafData[0];
            html += `<b>Issued:</b> ${taf.issue_time}<br>`;
            html += `<b>Valid:</b> ${taf.valid_time_from} → ${taf.valid_time_to}<br><br>`;

            taf.forecast.forEach((period, idx) => {
                html += `<b>Period ${idx + 1}:</b><br>`;
                html += `Start: ${period.fcst_time_from}<br>`;
                html += `End: ${period.fcst_time_to}<br>`;

                if (period.wind_dir && period.wind_speed) {
                    html += `Wind: ${period.wind_dir}${period.wind_speed}KT<br>`;
                }

                if (period.visibility) {
                    html += `Visibility: ${period.visibility}<br>`;
                }

              if (period.clouds && Array.isArray(period.clouds)) {
    html += `Clouds: ${period.clouds.map(c => c.cover + (c.base || "")).join(", ")}<br>`;
}

if (period.wx_string && typeof period.wx_string === "string") {
    html += `Weather: ${translateWx(period.wx_string)}<br>`;
}
                html += `<br>`;
            });
        }

        // Fetch METAR if checked
        if (includeMetar) {
            const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${airport}&format=json`;
            const metarResponse = await fetch(metarUrl);
            const metarData = await metarResponse.json();

            if (metarData.length > 0) {
                const m = metarData[0];
                html += `<b>METAR:</b><br>`;
                html += `${m.raw_text}<br><br>`;
            }
        }

        html += `</div>`;
    }

    output.innerHTML = html;
}

function translateWx(code) {
    const table = {
        "BR": "Mist",
        "FG": "Fog",
        "HZ": "Haze",
        "RA": "Rain",
        "DZ": "Drizzle",
        "SN": "Snow",
        "SG": "Snow Grains",
        "PL": "Ice Pellets",
        "TS": "Thunderstorm",
        "VCSH": "Showers in Vicinity",
        "SH": "Showers",
        "FZRA": "Freezing Rain",
        "FZDZ": "Freezing Drizzle"
    };

    return `${code}: ${table[code] || "Unknown"}`;
}

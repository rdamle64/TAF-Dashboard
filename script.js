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
        const tafUrl = `https://corsproxy.io/?https://aviationweather.gov/api/data/taf?ids=${airport}&format=json`;

        const tafResponse = await fetch(tafUrl);
        const tafRaw = await tafResponse.json();
        const tafData = tafRaw.data;   // <-- unwrap the proxy payload


        if (!Array.isArray(tafData) || tafData.length === 0) {
    html += `<p>No TAF data available.</p>`;
    output.innerHTML += html;
    continue;
}
 else {
            const taf = tafData[0];
            html += `<b>Issued:</b> ${taf.issue_time}<br>`;
            html += `<b>Valid:</b> ${taf.valid_time_from} → ${taf.valid_time_to}<br><br>`;

         // Safety check to prevent crashes if forecast is missing
if (!tafData || !tafData[0] || !tafData[0].forecast) {
    html += `<p>No TAF data available.</p>`;
    output.innerHTML += html;
    continue; // move to next airport
}
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
            const metarUrl = `https://corsproxy.io/?https://aviationweather.gov/api/data/metar?ids=${airport}&format=json`;

            const metarResponse = await fetch(metarUrl);
            const metarRaw = await metarResponse.json();
            const metarData = metarRaw.data;


           if (!Array.isArray(metarData) || metarData.length === 0) {
    html += `<p>No METAR data available.</p>`;
    output.innerHTML += html;
    continue;
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

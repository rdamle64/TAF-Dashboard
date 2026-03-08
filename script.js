// ---------- Utilities ----------

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

// ---------- Airport coordinates (extend as needed) ----------

const AIRPORT_COORDS = {
    KMQS: { lat: 39.875, lon: -75.865 },
    KLNS: { lat: 40.121, lon: -76.296 },
    KRDG: { lat: 40.378, lon: -75.965 },
    KABE: { lat: 40.652, lon: -75.440 },
    KPNE: { lat: 40.082, lon: -75.011 },
    KPHL: { lat: 39.874, lon: -75.242 },
    KILG: { lat: 39.678, lon: -75.606 },
    KTTN: { lat: 40.277, lon: -74.816 }
};

function toRad(deg) {
    return deg * Math.PI / 180;
}

function distanceNm(homeCoords, airportCode) {
    const coords = AIRPORT_COORDS[airportCode];
    if (!coords || !homeCoords) return null;

    const R = 3440.065; // nautical miles
    const dLat = toRad(coords.lat - homeCoords.lat);
    const dLon = toRad(coords.lon - homeCoords.lon);
    const lat1 = toRad(homeCoords.lat);
    const lat2 = toRad(coords.lat);

    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function sortAirportsByDistance(airports, homeCoords) {
    return airports.slice().sort((a, b) => {
        const da = distanceNm(homeCoords, a);
        const db = distanceNm(homeCoords, b);

        if (da === null && db === null) return a.localeCompare(b);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
    });
}

// ---------- METAR helpers (category + wind/gust) ----------

function classifyFlightCategory(metarText) {
    const visMatch = metarText.match(/ (\d+)\s*SM/);
    let vis = visMatch ? parseInt(visMatch[1], 10) : 10;

    const cigMatch = metarText.match(/ (BKN|OVC)(\d{3})/);
    let cig = cigMatch ? parseInt(cigMatch[2], 10) * 100 : 9999;

    if (vis < 1 || cig < 500) return "ifr";
    if (vis < 3 || cig < 1000) return "mvfr";
    return "vfr";
}

function windArrow(dirDeg) {
    const d = (dirDeg + 360) % 360;
    if (d >= 337.5 || d < 22.5) return "↑";
    if (d < 67.5) return "↗";
    if (d < 112.5) return "→";
    if (d < 157.5) return "↘";
    if (d < 202.5) return "↓";
    if (d < 247.5) return "↙";
    if (d < 292.5) return "←";
    return "↖";
}

function decorateWind(metarText) {
    return metarText.replace(
        /\b(\d{3})(\d{2,3})(G(\d{2,3}))?KT\b/,
        (match, dir, spd, _gFull, gust) => {
            const dirNum = parseInt(dir, 10);
            const arrow = windArrow(dirNum);
            let core = `<span class="wind-dir">${dir}°${arrow}</span>` +
                       ` <span class="wind-spd">${spd}KT</span>`;
            if (gust) {
                core += ` <span class="wind-gust">G${gust}</span>`;
            }
            return core;
        }
    );
}

// ---------- TAF helpers (format + color) ----------

function formatTaf(tafText) {
    return tafText
        .replace(/(FM\d{6})/g, "\n\n$1")
        .replace(/(TEMPO\s+\d{4}\/\d{4})/g, "\n\n$1")
        .replace(/(PROB\d{2}\s+\d{4}\/\d{4})/g, "\n\n$1")
        .trim();
}

function colorizeTaf(tafText) {
    let t = tafText;
    t = t.replace(/(^|\n)(FM\d{6})/g, (m, pre, fm) =>
        `${pre}<span class="taf-fm">${fm}</span>`
    );
    t = t.replace(/(^|\n)(TEMPO\s+\d{4}\/\d{4})/g, (m, pre, tempo) =>
        `${pre}<span class="taf-tempo">${tempo}</span>`
    );
    t = t.replace(/(^|\n)(PROB\d{2}\s+\d{4}\/\d{4})/g, (m, pre, prob) =>
        `${pre}<span class="taf-prob">${prob}</span>`
    );
    return t;
}

// ---------- Main ----------

async function runDashboard() {
    const airportsRaw = document.getElementById("airportInput").value
        .split(",")
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);

    // Home airport from input box
    const homeInput = document.getElementById("homeAirport");
    const homeCode = homeInput
        ? (homeInput.value.trim().toUpperCase() || "KMQS")
        : "KMQS";

    const homeCoords = AIRPORT_COORDS[homeCode] || AIRPORT_COORDS["KMQS"];

    // Sort airports by distance from home
    let airports;
    if (homeCoords) {
        airports = sortAirportsByDistance(airportsRaw, homeCoords);
    } else {
        airports = airportsRaw.slice().sort();
    }

    const includeMetar = document.getElementById("includeMetar").checked;
    const output = document.getElementById("output");
    output.innerHTML = "Loading...";

    let html = "";

    // Warm-up to avoid first-request timeout
    try {
        await fetchWithRetry(
            "https://api.allorigins.win/raw?url=" +
            encodeURIComponent("https://aviationweather.gov/api/data/taf?ids=KJFK")
        );
        await sleep(300);
    } catch (err) {}

    for (const airport of airports) {
        await sleep(300); // throttle

        html += `<div class="airport-block"><div class="title">${airport}</div>`;

        // ----- TAF -----
        const tafUrl =
            "https://api.allorigins.win/raw?url=" +
            encodeURIComponent(`https://aviationweather.gov/api/data/taf?ids=${airport}`);

        try {
            const tafResponse = await fetchWithRetry(tafUrl);
            const tafText = await tafResponse.text();

            if (!tafText || tafText.trim().length === 0) {
                html += `<p>No TAF data available.</p>`;
            } else {
                const formatted = formatTaf(tafText.trim());
                const colored = colorizeTaf(formatted);
                html += `<b>TAF:</b><br><pre class="taf">${colored}</pre>`;
            }
        } catch (err) {
            html += `<p>Error loading TAF data.</p>`;
        }

        // ----- METAR -----
        if (includeMetar) {
            const metarUrl =
                "https://api.allorigins.win/raw?url=" +
                encodeURIComponent(`https://aviationweather.gov/api/data/metar?ids=${airport}`);

            try {
                const metarResponse = await fetchWithRetry(metarUrl);
                const metarText = await metarResponse.text();

                if (!metarText || metarText.trim().length === 0) {
                    html += `<p>No METAR data available.</p>`;
                } else {
                    const trimmed = metarText.trim();
                    const category = classifyFlightCategory(trimmed);
                    const decorated = decorateWind(trimmed);
                    html += `<b>METAR:</b><br><pre class="metar ${category}">${decorated}</pre>`;
                }
            } catch (err) {
                html += `<p>Error loading METAR data.</p>`;
            }
        }

        html += `</div>`;
    }

    output.innerHTML = html || "No airports specified.";
}

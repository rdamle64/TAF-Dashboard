// ---------- Utilities ----------

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = 2) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetch(url);
        } catch (err) {
            await sleep(300);
        }
    }
    throw new Error("Fetch failed after retries");
}

// ---------- Airport coordinates ----------

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

function toRad(deg) { return deg * Math.PI / 180; }

function distanceNm(homeCoords, airportCode) {
    const coords = AIRPORT_COORDS[airportCode];
    if (!coords) return null;

    const R = 3440.065;
    const dLat = toRad(coords.lat - homeCoords.lat);
    const dLon = toRad(coords.lon - homeCoords.lon);
    const lat1 = toRad(homeCoords.lat);
    const lat2 = toRad(coords.lat);

    const h = Math.sin(dLat/2)**2 +
              Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;

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

// ---------- METAR helpers ----------

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
            const arrow = windArrow(parseInt(dir, 10));
            let core = `<span class="wind-dir">${dir}°${arrow}</span> <span class="wind-spd">${spd}KT</span>`;
            if (gust) core += ` <span class="wind-gust">G${gust}</span>`;
            return core;
        }
    );
}

// ---------- TAF helpers ----------

function formatTaf(tafText) {
    return tafText
        .replace(/(FM\d{6})/g, "\n\n$1")
        .replace(/(TEMPO\s+\d{4}\/\d{4})/g, "\n\n$1")
        .replace(/(PROB\d{2}\s+\d{4}\/\d{4})/g, "\n\n$1")
        .trim();
}

function colorizeTaf(tafText) {
    return tafText
        .replace(/(^|\n)(FM\d{6})/g, "$1<span class='taf-fm'>$2</span>")
        .replace(/(^|\n)(TEMPO\s+\d{4}\/\d{4})/g, "$1<span class='taf-tempo'>$2</span>")
        .replace(/(^|\n)(PROB\d{2}\s+\d{4}\/\d{4})/g, "$1<span class='taf-prob'>$2</span>");
}

// ---------- v15: Sequential Loading ----------

async function loadAirport(airport, includeMetar, container) {
    container.innerHTML = `<div class="title">${airport}</div><p class="loading">Loading...</p>`;

    // TAF
    try {
        const tafUrl = "https://api.allorigins.win/raw?url=" +
            encodeURIComponent(`https://aviationweather.gov/api/data/taf?ids=${airport}`);

        const tafResponse = await fetchWithRetry(tafUrl, 3);
        const tafText = await tafResponse.text();

        if (tafText.trim().length > 0) {
            const formatted = formatTaf(tafText.trim());
            const colored = colorizeTaf(formatted);
            container.innerHTML = `<div class="title">${airport}</div><b>TAF:</b><br><pre class="taf">${colored}</pre>`;
        } else {
            container.innerHTML = `<div class="title">${airport}</div><p>No TAF data.</p>`;
        }
    } catch {
        container.innerHTML = `<div class="title">${airport}</div><p>Error loading TAF.</p>`;
    }

    // METAR
    if (includeMetar) {
        try {
            const metarUrl = "https://api.allorigins.win/raw?url=" +
                encodeURIComponent(`https://aviationweather.gov/api/data/metar?ids=${airport}`);

            const metarResponse = await fetchWithRetry(metarUrl, 3);
            const metarText = await metarResponse.text();

            if (metarText.trim().length > 0) {
                const trimmed = metarText.trim();
                const category = classifyFlightCategory(trimmed);
                const decorated = decorateWind(trimmed);
                container.innerHTML += `<b>METAR:</b><br><pre class="metar ${category}">${decorated}</pre>`;
            } else {
                container.innerHTML += `<p>No METAR data.</p>`;
            }
        } catch {
            container.innerHTML += `<p>Error loading METAR.</p>`;
        }
    }
}

async function runDashboard() {
    const airportsRaw = document.getElementById("airportInput").value
        .split(",")
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);

    const homeCode = document.getElementById("homeAirport").value.trim().toUpperCase() || "KMQS";
    const homeCoords = AIRPORT_COORDS[homeCode] || AIRPORT_COORDS["KMQS"];

    const airports = sortAirportsByDistance(airportsRaw, homeCoords);
    const includeMetar = document.getElementById("includeMetar").checked;

    const output = document.getElementById("output");
    output.innerHTML = "";

    // Create empty containers first
    const containers = {};
    airports.forEach(a => {
        const div = document.createElement("div");
        div.className = "airport-block";
        div.innerHTML = `<div class="title">${a}</div><p class="loading">Waiting...</p>`;
        output.appendChild(div);
        containers[a] = div;
    });

    // Sequential loading
    for (const airport of airports) {
        await loadAirport(airport, includeMetar, containers[airport]);
        await sleep(300);
    }
}

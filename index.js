// expected data from the api:
// gamemodesURL gives all gamemodes and their score colors as an array of arrays of gamemode & its color, e.x. [["FFA", "#abc123"], [,], ...]
// next three cells are strings that when combined together give a 2d array of the data in the records sheet
const CONSTANTS = {
    gamemodesURL: 'https://spreadsheets.google.com/feeds/cells/1HDQtELScci0UlVR4ESnvhM6V8bgAtNX8GI3pzq7cG8M/1/public/basic?range=F5:F5&alt=json',
    dataURL: 'https://spreadsheets.google.com/feeds/cells/1HDQtELScci0UlVR4ESnvhM6V8bgAtNX8GI3pzq7cG8M/1/public/basic?range=G5:I5&alt=json',
};


// make the main table of tanknames and records
getData()
    .then(data => makeTable(data));

const themePicker = document.querySelector("#choose-theme");
themePicker.addEventListener("change", changeTheme);


async function getData() {  
    let response = await fetch(CONSTANTS.dataURL);
    let data = await response.json();
    
    data = data.feed.entry
            .map(item => item.content.$t) // look at the json returned in order to make sense of this stuff
            .join("") // sheets has max char limit per cell, so this recombines the split up data into one giant string again
            .slice(2, -2) // remove the [[ at the beginning and ]] at the end
            .split("],[") // make each sheet row into an array row
            .map(row => row.split(",")) // split each array row into another array, representing each cell in that row
            .map(row => row.map(cell => // JSON returns extra "" around every string, so this removes them and also converts the score cells into ints
            cell.includes(`"`) ? cell.slice(1,-1) : parseInt(cell, 10) 
            )) 
            ;

    console.log(data);
    
    return data;
}

// return a document fragment that can be directly appended to tierRows
async function makeGamemodesRow() {      
    const gamemodesArray = await getGamemodesArray();
    let fragment = document.createDocumentFragment();
    
    // gamemodesArray is in the format of a long array
    // where 1st item is gamemode name, and then its immediately followed
    // by its color -> ["FFA", "#123abc", "2TDM", "#aabbcc", ...]
    for (let i = 0; i < gamemodesArray.length; i += 2) {
        const cell = document.createElement("th");
        cell.textContent = gamemodesArray[i];
        cell.style.backgroundColor = gamemodesArray[i + 1];
        cell.classList.add("gamemode-cell");

        fragment.appendChild(cell);
    }

    return fragment;
}


async function makeTable(data) {
    let table = document.createElement("table");

    //todo: to make frozen: https://stackoverflow.com/questions/48593384/html-table-frozen-columns-with-pure-javascript-little-css

    // make actual table data
    for (const dataRow of data) {
        const tableRow = document.createElement("tr");


        // spacing rows (fully blank between tiers)
        // tier rows (say Tier 1/2/3/4)
        const isSpacingRow = (!dataRow[0] && !dataRow[1]);
        const isTierRow = (!dataRow[0] && dataRow[1].toLowerCase().includes("tier"));

        if (isSpacingRow) tableRow.classList.add("spacing-row");
        else if (isTierRow) tableRow.classList.add("tier-row");

        
        // create cells for the tankPic col
        const tankPicCell = document.createElement("td");
        // add images, but only do it for actual tank rows
        if (!isTierRow && !isSpacingRow) {
            const tankPic = document.createElement("img");
            tankPic.src = dataRow[0];
            tankPic.height = "50"; // px
            tankPicCell.appendChild(tankPic);
        }
        // for the tier rows, make 1 cell spanning both 1st 2 cols
        else if (isTierRow) {
            tankPicCell.colSpan = "2";
            tankPicCell.textContent = dataRow[1];
        }
        tableRow.appendChild(tankPicCell);



        // tank name cols
        // tier rows have been taken care of above (1 giant cell spanning both tankpic and tankname)
        if (!isTierRow) {
            const tankName = document.createElement("td");
            tankName.textContent = dataRow[1];
            tableRow.appendChild(tankName);
        }
        


        // skip ahead to next row if spacing or tier
        // aka, theres only 1 child at the moment for these rows
        if (isTierRow || isSpacingRow) {
            table.appendChild(tableRow);
            continue;
        }



        // make records cells for normal tank rows
        // start at 2 since tank/tankPic col, theres 3 cells per record (score/name/proofLink)
        for (let col = 2; col < dataRow.length; col += 3) {
            const tableCell = document.createElement("td");

            // empty proofLink means theres no record there yet
            // attach empty cell, and continue
            const proofLink = dataRow[col + 2];
            if (proofLink === "") {
                tableRow.appendChild(tableCell);
                continue;
            }

            const score = dataRow[col];
            const formattedScore = formatNumber(score);
            const playerName = dataRow[col + 1];

            // make a link, and set it to open in new window, and prevent window.open malicious stuff
            const link = document.createElement("a");
            link.setAttribute("href", proofLink);
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener");
            
            // add playerName like this instead of using innerHTML to prevent XSS injection
            link.textContent = playerName;

            // add bolded score and then linebreak right before the playerName
            link.insertAdjacentHTML("afterbegin", `<strong>${formattedScore}</strong><br/>`);

            // make bg color based on the score
            tableCell.style.backgroundColor = getScoreColor(score);

            tableCell.appendChild(link);
            tableRow.appendChild(tableCell);
        }

        table.appendChild(tableRow);
    }

    // make the table editable on DOM by attaching it to the body
    // however it will be invisible for now
    document.querySelector("body").appendChild(table);


    // now make the gamemodes rows using a DOM fragment
    // , and attach the fragment to tierRows
    const gamemodesFragment = await makeGamemodesRow();
    const tierRows = document.querySelectorAll(".tier-row");

    tierRows.forEach(row => {
        // we have to clone the fragment before appending, otherwise it disappears
        // true indicates that we want a deep clone 
        // (aka not just the row, but its descendant cells as well)
        const clone = gamemodesFragment.cloneNode(true);
        row.appendChild(clone);
    });


    // now that everything is done, make the body visible
    // this is done to give the illusion that everything happens all at once on page load
    document.querySelector("body").style.visibility = "visible";
}


    


// passed in as an actual number now
function getScoreColor(score) {
    const mil = 10**6;

    if      (score < 1.0*mil) return "var(--background)";
    else if (score < 1.5*mil) return "var(--score-10-15)";
    else if (score < 2.0*mil) return "var(--score-15-20)";
    else if (score < 2.5*mil) return "var(--score-20-25)";
    else if (score < 3.0*mil) return "var(--score-25-30)";
    else if (score < 3.5*mil) return "var(--score-30-35)";
    else if (score < 4.0*mil) return "var(--score-35-40)";
    else if (score < 5.0*mil) return "var(--score-40-50)"; // [4mil to 5mil)
    else if (score < 6.0*mil) return "var(--score-50-60)"; // [5mil to 6mil)
    else if (score < 7.5*mil) return "var(--score-60-75)"; // [6mil to 7.5mil)
    else if (score < 10.0*mil) return "var(--score-75-100)"; // [7.5mil to 10mil)
    else if (score >= 10.0*mil) return "var(--score-100-up)"; // 10mil and above
}


// 1234567 -> 1.23mil, 123456 -> 123.46k
function formatNumber(score) {
    if (score >= 10**6) return (score / 10**6).toFixed(2) + "mil";
    else return (score / 1000).toFixed(2) + "k";
}



async function getGamemodesArray() {
    let response = await fetch(CONSTANTS.gamemodesURL);
    let data = await response.json();
    
    data = data.feed.entry
                .map(item => item.content.$t) // look at the json returned in order to make sense of this stuff
                .shift() // array only has 1 element, so set data to that element (the string of an array)
                .slice(1, -1) // remove the [ at the beginning and the ] at the end
                .split(",") // turn string into array again
                .map(item => item.slice(1,-1)) // JSON adds extra "" around everything, so remove them
                ;

    console.log(data);
    
    return data;
}



// todo: for normal theme options
function changeTheme() {
    const themes = {
            "sand": {
            "--background":    "#cbb690",
            "--tank-col":      "#9E8171",
            "--tier":          "#7e6558",
            "--normal-text":   "#000000",
            "--opposite-text": "#F5DEB3",
            "--hover-text":    "#795548",
            "--border":        "#cbb690",
            "--score-10-15":   "#CFA087",
            "--score-15-20":   "#989B9D",
            "--score-20-25":   "#F0C143",
            "--score-25-30":   "#DF7D73",
            "--score-30-35":   "#95C378",
            "--score-35-40":   "#AD93C1",
            "--score-40-50":   "#649BD0",
            "--score-50-60":   "#EAE0C9",
            "--score-60-75":   "#FFA346",
            "--score-75-100":  "#91CBD6",
            "--score-100-up":  "#91CBD6",
        },
        "shadow": { /* based on Gruvbox theme */
            "--background":    "#282828", //
            "--tank-col":      "#504945", //
            "--tier":          "#3c3836", //
            "--normal-text":   "#ebdbb2", //
            "--opposite-text": "#ebdbb2", //
            "--hover-text":    "#FFB7C5", // chose pink since it won't interfere with anything else
            "--border":        "#282828", //
            "--score-10-15":   "#928374",
            "--score-15-20":   "#928374",
            "--score-20-25":   "#427B58",
            "--score-25-30":   "#427B58",
            "--score-30-35":   "#076678",
            "--score-35-40":   "#076678",
            "--score-40-50":   "#8f3f71",
            "--score-50-60":   "#9d0006",
            "--score-60-75":   "#9d0006",
            "--score-75-100":  "#d65d0e",
            "--score-100-up":  "#C6930A", // not in gruvbox yellow - 	#C6930A, gruvbox colors - https://vimawesome.com/plugin/gruvbox
        },
        "silver": {
            background: "gray",
        },
        "snow": {
            background: "#f1f1f1"
        },
    };

    const root = document.querySelector(":root").style;
    const theme = themes[themePicker.value];

    for (const variable in theme) {
        root.setProperty(variable, theme[variable]);
    }

    // darken the gamemode colors and tank pics for non-sand themes
    // can't be done anyway else because the theme colors and tank pics are
    // imported from the sheet in order to make the website never need maintenance
    const gamemodeCells = document.querySelectorAll(".gamemode-cell");
    gamemodeCells.forEach(cell => {
        cell.style.opacity = (themePicker.value === "sand") ? "1" : "0.75";
    });

    const tankPics = document.querySelectorAll("img");
    tankPics.forEach(pic => {
        pic.style.filter = (themePicker.value === "sand") ? "brightness(100%)" : "brightness(75%)";
    });
}


// todo: this will only work once the css color variables are changed to match the arras theme color names
function useCustomTheme(theme) {
    const html = document.querySelector("html");

    for (const color in theme.content) {
        html.style.setProperty(`--${color}`, theme.content[color]);
    }
}

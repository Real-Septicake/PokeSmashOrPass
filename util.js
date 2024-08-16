const fs = require("fs");

const count = 20;

const nameMap = JSON.parse(fs.readFileSync("./nameMap.json", "utf-8"));
const idMap = JSON.parse(fs.readFileSync("./idMap.json", "utf-8"))
const countMax = Object.keys(nameMap).length;

async function genMaps() {
    var finished = false;
    let names = {}
    let ids = {}
    let offset = 0;
    while(!finished){
        await fetch(`https://pokeapi.co/api/v2/pokemon/?limit=${count}&offset=${offset}`).then(response => response.json())
        .then(data => {
            if(data.results.length != count) {
                finished = true;
            }
            offset += data.results.length;
            console.log(offset, "pokemon completed.")
            let promisesArray = data.results.map(async result => {
                const response = await fetch(result.url);
                return await response.json();
            })
            return Promise.all(promisesArray);
        })
        .then(data => {
            data.forEach(value => {
                if(value.id > offset) {
                    finished = true;
                    return;
                }
                names[value.name] = value.id
                ids[value.id] = value.name
            })
        });
    }

    fs.writeFile("./nameMap.json", JSON.stringify(names, null, 2), (error) => {
        if(error) {
            console.log("An error has occurred ", error);
        }
    })

    fs.writeFile("./idMap.json", JSON.stringify(ids, null, 2), (error) => {
        if(error) {
            console.log("An error has occurred ", error);
        }
    })
}

function mathPercent(smash, pass) {
    if(pass === 0 && smash === 0) return -1;
    else return (smash / (pass + smash)) * 100;
}

function percent(pokeId, type) {
    let smash = Object.keys(pokeInfo[pokeId]?.['smash'])?.length;
    let pass = Object.keys(pokeInfo[pokeId]?.['pass'])?.length;
    let total = smash + pass || 0;
    if(total == 0) {
        return -1;
    } else {
        return +(((Object.keys(pokeInfo[pokeId][type]).length / total) * 100).toFixed(2));
    }
}

module.exports = { genMaps, nameMap, idMap, countMax, percent, mathPercent };
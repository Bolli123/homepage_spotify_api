import fetch from "node-fetch"
import express from "express"
import cors from "cors"

const app = express()
const PORT = process.env.VIRTUAL_PORT

var token = {
    token: '',
    expires: Date.now() / 1000
}
var getAuthOptions
var refreshToken

const topUrl = "https://api.spotify.com/v1/me/top/"

const favorites = {
    artist: {
        title: "Deftones",
        altTitle: "alternative metal",
        image: "https://i.scdn.co/image/ab67616d0000b27366c9f5d6f13bfc9abedc1056",
        link: "https://open.spotify.com/artist/6Ghvu1VvMGScGpOUJBAHNH"
    },
    track: {
        title: "There is a light that never goes out",
        altTitle: "The Smiths",
        image: "https://i.scdn.co/image/ab67616d0000b273ada101c2e9e97feb8fae37a9",
        link: "https://open.spotify.com/track/0WQiDwKJclirSYG9v5tayI"
    },
    album: {
        title: "In Utero",
        altTitle: "Nirvana",
        image: "https://i.scdn.co/image/ab67616d0000b273c4f52ef8782f0e8ede4c1aaf",
        link: "https://open.spotify.com/album/7wOOA7l306K8HfBKfPoafr"
    },
    generated: -1
}

async function getAccessToken(refresh = false) {
    const _ = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: getAuthOptions.headers,
        body: new URLSearchParams(
            //if using refresh token
            refresh ?
            {
                grant_type: "refresh_token",
                refresh_token: refreshToken
            }
            :
                getAuthOptions.body
            )
    })
    .then(response => response.json())
    .then(data => {
        token.token = `${data.token_type} ${data.access_token}`
        token.expires = data.expires_in + (Date.now() / 1000)
        //If the server decides to send a new refresh token, according to the API...
        if (data.refresh_token) {
            refreshToken = data.refresh_token
        }
    })
    return token
}

async function checkToken(token) {
    if ((token.expires) <= (Date.now() / 1000)) {
        return await getAccessToken(true)
    } 
    return
}

async function getAlbum(id) {
    return await fetch("https://api.spotify.com/v1/albums/" + id, {
        methhod: 'GET',
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Authorization": token.token
        }
    })
    .then(res => {
        if (res.status !== 200) {
            throw Error(res.status)
        }
        return res
    })
    .then(res => res.json())
    .then(data => {
        if (typeof data === 'undefined') return;
        const album = {
            title: data.name,
            altTitle: data.artists[0].name,
            image: data.images[1].url,
            link: "https://open.spotify.com/album/" + id
        }
        return album
    })
    .catch((error) => {
        console.log(error)
    })
}

async function getAlbumArtByArtist(id, limit = 5) {
    return await fetch(`https://api.spotify.com/v1/artists/${id}/albums?limit=${limit}`, {
        methhod: 'GET',
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Authorization": token.token
        }
    })
    .then(res => {
        if (res.status !== 200) {
            throw Error(res.status)
        }
        return res
    })
    .then(res => res.json())
    .then(data => {
        return data.items[Math.floor(Math.random() * limit)].images[1].url
    })
    .catch((error) => {
        console.log(error)
    })
}

async function getFavorite(type, limit, offset = 0) {
    return await fetch(topUrl + `${type}s?time_range=short_term&limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Authorization": token.token
        }
    })
    .then(res => {
        if (res.status === 401) {
            throw 'Token Expired'
        }
        if (res.status !== 200) {
            throw Error(res.status)
        }
        return res
    })
    .then(res => res.json())
    .then(data => {
        return data
    }).catch((error) => { 
        console.log(error)
    })
}

async function getFavoriteArtist() {
    var offset = 0
    return await getFavorite("artist", 2)
    .then(async data => {
        if (typeof data === 'undefined') return;
        if (data.items[0].name === favorites.album.altTitle) {
            offset += 1
        }
        var img = await getAlbumArtByArtist(data.items[offset].id)
        const artist = {
            title: data.items[offset].name,
            altTitle: data.items[offset].genres[0],
            //replace dogshit artist image 
            image: img ? img : data.items[offset].images[1].url,
            link: "https://open.spotify.com/artist/" + data.items[offset].id
        }
        return artist
    })
}

async function getFavoriteTrack() {
    return await getFavorite("track", 1)
    .then(data => {
        if (typeof data === 'undefined') return;
        const track = {
            title: data.items[0].name,
            altTitle: data.items[0].artists[0].name,
            image: data.items[0].album.images[1].url,
            link: "https://open.spotify.com/track/" + data.items[0].id
        }
        return track
    })
}

async function getFavoriteAlbum() {
    //API has no funcitonality for albums
    const tracks = await getFavorite("track", 40)
    if (typeof tracks === 'undefined') return;
    const albums = new Map()
    let favoriteAlbum = {id: '', freq: 0}
    //Check how many times an album shows up on top tracks
    for (const track of tracks.items) {
        let currentAlbum = track.album.id
        albums.set(currentAlbum, (albums.get(currentAlbum) ?? 0) + 1)
    }
    //Find most frequent album
    for (const [key, value] of albums.entries()) {
        if (favoriteAlbum.freq < value) {
            favoriteAlbum.id = key
            favoriteAlbum.freq = value
        }
    }
    const album = await getAlbum(favoriteAlbum.id)
    if (typeof album === 'undefined') return;
    return album
}

async function checkFavorites() {
    await checkToken(token)
    if (favorites.generated + 86400 <= (Date.now() / 1000)) {
        console.log("Generating new favorites...")
        const track = await getFavoriteTrack()
        const album = await getFavoriteAlbum()
        const artist = await getFavoriteArtist()
        //In case of failure use defaults/previous favorite
        favorites.artist = artist ? artist : favorites.artist
        favorites.track = track ? track : favorites.track
        favorites.album = album ? album : favorites.album
        favorites.generated = Date.now() / 1000
    }
}

async function appInit() {
    getAuthOptions = {
        headers: {
            Authorization: 'Basic ' + (new Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64')),
            'Content-Type': "application/x-www-form-urlencoded"
        },
        body: {
            grant_type: "authorization_code",
            code: process.env.AUTH_CODE,
            redirect_uri: 'https://bjornbreki.is/'
        }
    }
    await getAccessToken()
    await checkFavorites()
}

app.use(cors({
    origin: process.env.VIRTUAL_HOST,
}));

app.get('/getFavorites', async (req, res) => {
    res.send(favorites)
    checkFavorites()
})

app.listen(PORT, async () => {
    await appInit()
    console.log(`Listening on port ${PORT}`)
})
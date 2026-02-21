// Pockitt/wwwroot/js/geo.js
// Raw GPS coordinates are encoded here and immediately discarded
// Only the geohash string is ever sent to the server.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes a lat/lng pair into a geohash string.
 * Precision 5 = ~5km x 5km cell.
 */
function encodeGeohash(lat, lng, precision = 5){
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';

    let minLat = -90, maxLat = 90;
    let minLng = -180, maxLng = 180;

    while(geohash.length < prescision){
        if(evenBit){
            const midLng = (minLng + maxLng) / 2;
            if(lng >= midLng){ idx = (idx << 1) | 1; minLng = midLng; }
            else{ idx = idx << 1; maxLng = midLng; }
        } else{
            const midLat = (minLat + maxLat) / 2;
            if(lat >= midLat){ idx = (idx << 1) | 1; minLat = midLat; }
            else{ idx = idx << 1; maxLat = midLat; }
        }
        evenBit = !evenBit;

        if(bit++ === 5){
            geohash += BASE32[idx];
            bit = 0;
            idx = 0;
        }
    }
    return geohash;
}

/**
 * Requests the user's GPS position and resolves with a precision-5 geohash.
 * Raw coordinates are never stored or forwarded.
 * @returns {Promise<string>} 5-character geohash
 */
export function getGeoHash(){
    return new Promise((resolve, reject) => {
        if(!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({coords }) => {
                const geohash = encodeGeohash(coords.latitude, coords.longitude, 5);
                resolve(geohash); // coords.latitude / .longitude discarded here 
            },
            (err) => reject(err),
            {
                enableHighAccuracy: false, // coarse location is intentional 
                timeout: 10000,
                maximumAge: 60000 // accept a cached position up to 1 min old
            }
        );
    });
}
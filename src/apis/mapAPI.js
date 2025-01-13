import axios from "axios";

function geocodingData(query) {
    return axios.get(`/geocode/${query}`);
}

function getDirectionData(departureCoordinate, destinationCoordinate){
    return axios.get('/driving', {
        params: {
          departureX: departureCoordinate.x,
          departureY: departureCoordinate.y,
          destinationX: destinationCoordinate.x,
          destinationY: destinationCoordinate.y
        }
    });
}

export default {
    geocodingData,
    getDirectionData,

}
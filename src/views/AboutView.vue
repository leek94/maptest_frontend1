<template>
  <div>
    <input v-model="departure" placeholder="출발지 입력" />
    <input v-model="destination" placeholder="도착지 입력" />
    <button @click="searchRoute">경로 검색</button>
    <div id="map" ref="mapRef" style="width:100%;height:500px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import mapAPI from '@/apis/mapAPI';

const mapRef = ref(null);
const departure = ref('');
const destination = ref('');
const departureCoordinate = ref({});
const destinationCoordinate = ref({});
let map = null;

const CLIENT_ID = 'f4rq9sijuj';
const CLIENT_SECRET = 'BRnfWGTxsdbd3lzmJuTDknGJHEgwBTpDNEoiLxRM';

onMounted(() => {
  if (window.naver && window.naver.maps) {
    initMap();
  } else {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=f4rq9sijuj&submodules=geocoder`;
    script.onload = initMap;
    document.head.appendChild(script);
  }
});

function initMap() {
  const mapOptions = {
    center: new window.naver.maps.LatLng(37.519259, 127.034426),
    zoom: 17
  };
  
  map = new window.naver.maps.Map(mapRef.value, mapOptions);
}

// 출발지와 도착지 작성 및 백엔드 파라미터 전달 함수 호출
async function searchRoute() {
  if (!departure.value || !destination.value) {
    alert('출발지와 도착지를 모두 입력해주세요.');
    return;
  }

  await searchAddress(departure.value, 'departure');
  await searchAddress(destination.value, 'destination');
}


// 백엔드 호출 및 데이터 좌표 값 저장 함수 호출
async function searchAddress (query, type){
  try{
    console.log("쿼리값 출력" + query);
    const response = await mapAPI.geocodingData(query);
    const data = response.data;
    console.log( `${type} 좌표: `, data );
    
    if (type === 'departure') {
      // 출발지 데이터 처리 및 저장
      storeDepartureData(data);
    } else if (type === 'destination') {
      // 도착지 데이터 처리 및 저장
      storeDestinationData(data);
    }

    // 거리 측정 백엔드 호출
    await getDirection(departureCoordinate.value, destinationCoordinate.value);

  } catch (error) {
    console.log(error);
  }

}

async function getDirection (departureCoordinate, destinationCoordinate){
  try{
    const response = await mapAPI.getDirectionData(departureCoordinate, destinationCoordinate);
  } catch(error) {
    console.log('경로 탐색 중 오류 발생', error);
  }

}


// 출발 데이터 좌표 저장 함수
function storeDepartureData(data) {
  console.log("출발지 data값" + data.x + " : " + data.y);
  departureCoordinate.value = {
    x: data.x,
    y: data.y
  };
  console.log("출발지 데이터 저장값:" + departureCoordinate.value.x + " : "+ departureCoordinate.value.y);
}

// 도착 데이터 좌표 저장 함수
function storeDestinationData(data) {
  console.log("도착지 data값" + data.x + " : " + data.y);
  destinationCoordinate.value = {
    x: data.x,
    y: data.y
  };
  console.log("도착지 데이터 저장값:" + destinationCoordinate.value.x +" : " +  destinationCoordinate.value.y);
}


</script>
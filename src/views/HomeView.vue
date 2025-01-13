<template>
  <div>
    <input v-model="departure" placeholder="출발지 입력" />
    <input v-model="destination" placeholder="도착지 입력" />
    <button @click="searchRoute">경로 검색</button>
    <div id="map" ref="mapRef" style="width:100%;height:500px;"></div>

  <div v-if="isDataLoaded">

  <h3>경로 안내</h3>
  <table border="1" style="width:100%; margin-top: 20px;">
    <thead>
      <tr>
        <th>#</th>
        <th>안내</th>
        <th>거리 (km)</th>
        <th>소요 시간 (분:초)</th> 
      </tr>
    </thead>
    <tbody>
      <tr v-for="(guide, index) in directionObject.route.traoptimal[0].guide" :key="index">
        <td>{{ index + 1 }}</td>
        <td>{{ guide.instructions }}</td>
        <td>{{ (guide.distance / 1000).toFixed(2) }}</td>
        <td>
          {{ Math.floor(guide.duration / (1000 * 60)) }}분
          {{ Math.floor((guide.duration / 1000) % 60) }}초
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 전체 경로 정보 테이블 -->
  <h3>전체 경로 정보</h3>
     <table  border="1" style="width:100%; margin-top: 20px;">
        <thead>
          <tr>
            <th>전체 거리 (km)</th>
            <th>전체 시간 (분:초)</th>
            <th>연료 비용 (원)</th>
            <th>택시 요금 (원)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ (totalDetails.value.totalDistance / 1000).toFixed(2) }} km</td>
            <td>
              {{ Math.floor(totalDetails.value.totalDuration / (1000 * 60)) }}분
              {{ Math.floor((totalDetails.value.totalDuration / 1000) % 60) }}초
            </td>
            <td>{{ totalDetails.value.fuelPrice?.toLocaleString() || 0 }} 원</td>
            <td>{{ totalDetails.value.taxiFare?.toLocaleString() || 0 }} 원</td>
          </tr>
        </tbody>
      </table> 
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, reactive } from 'vue';
import mapAPI from '@/apis/mapAPI';

const mapRef = ref(null); // 네이버 맵을 불러오기 위한 div 태그 자체를 참조
const departure = ref(''); // 출발지 검색어 양방향
const destination = ref(''); // 도착지 검색어 양방향
const departureCoordinate = ref({}); // 출발지 경도, 위도 좌표
const destinationCoordinate = ref({}); // 도착지 경도, 위도 좌표
let map = null; // 생성된 네이버 지도 객체 저장
const directionObject = ref({
  route: {
    traoptimal: [
      {
        guide: [],
        summary: {
          distance: 0,
          duration: 0,
          fuelPrice: 0,
          taxiFare: 0,
          tollFare: 0,
        },
      },
    ],
  },
}); // Direction API를 통한 전체 값
let existingPolyline = null; // 폴리라인 객체
const guideDetails = ref([]); // 각 가이드 정보 (분기점정보, 지시, 거리, 소요시간)

// 데이터 바인딩후 랜더링을 하려고 했는데 값을 읽지를 못하는 에러가 발생
// reactive를 사용해서 내부 속성 변화를 UI에 즉각 반영하게 하여 해결
const totalDetails = reactive({
  totalDistance: 0,
  totalDuration: 0,
  fuelPrice: 0,
  taxiFare: 0,
  tollFare: 0,
}); // 전체 정보 (거리, 소요시간, 유류비, 택시요금, 톨비)
const isDataLoaded = ref(false); // 데이터 로드 상태 추적

const CLIENT_ID = process.env.VUE_APP_CLIENT_ID;

watch(
  () => totalDetails.value,
  (newValue) => {
    console.log("totalDetails 변경됨:", newValue);
    console.log("경로 데이터 전체:", JSON.stringify(totalDetails.value, null, 2))
  }
);

watch(
  () => isDataLoaded.value,
  (newValue) => {
    console.log("isDataLoaded 상태:", newValue);
  }
);

onMounted(() => {
  if (window.naver && window.naver.maps) {
    initMap();
  } else {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${CLIENT_ID}&submodules=geocoder`;
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
      await storeDepartureData(data);
    } else if (type === 'destination') {
      // 도착지 데이터 처리 및 저장
      await storeDestinationData(data);
    }

    if ( isValidCoordinate(departureCoordinate.value) && isValidCoordinate(destinationCoordinate.value) ){
      // 거리 측정 함수 호출
      await getDirection(departureCoordinate.value, destinationCoordinate.value);
    } else {
      console.log("유효한 출발지 또는 도착지 좌표가 없습니다.");
    }

  } catch (error) {
    console.log(error);
  }

}

//  거리 측정 백엔드 호출 함수
async function getDirection (departureCoordinate, destinationCoordinate){
  try{
    isDataLoaded.value = false; // 데이터 로딩 시작
    const response = await mapAPI.getDirectionData(departureCoordinate, destinationCoordinate);
    directionObject.value = response.data;

    // 데이터가 제대로 로드되었는지 확인 후 상태 변경
    if (directionObject.value.route.traoptimal.length) {
      console.log("경로 데이터 로드 완료:" +  directionObject.value);
      await extraRouteDetails(directionObject.value);
      console.log("전체 경로 거리: " + totalDetails.value.totalDistance);
      console.log("전체 경로 시간: " + totalDetails.value.totalDuration);

      await nextTick();
      isDataLoaded.value = true;
    
    } else {
      console.log("경로 데이터가 비어 있습니다.");
      directionObject.value = { route: { traoptimal: [] } };
      
    }

    // console.log("경로 데이터 전체:", JSON.stringify(directionObject.value, null, 2));

    // 정보 가공 함수 호출
    drawPolyline();

  } catch(error) {
    console.log('경로 탐색 중 오류 발생', error);
  }

}

// 정보 가공 함수
async function extraRouteDetails(directionObject){
  const route = directionObject.route.traoptimal[0]; // 최적 경로
  const summary = directionObject.route.traoptimal[0].summary; // 경로 요약 정보

  // 1. 분기점 안내 정보 추출
  guideDetails.value = route.guide.map((item) => ({
    type: item.type,
    instructions: item.instructions,
    distance: item.distance,
    duration: item.duration,
  }));

  // 2. 전체 정보 추출
  totalDetails.value = {
    totalDistance: summary.distance || 0, // 전체 거리 (m)
    totalDuration: summary.duration || 0, // 전체 소요 시간 (ms)
    fuelPrice: summary.fuelPrice || 0, // 유류비
    taxiFare: summary.taxiFare || 0, // 택시 요금
    tollFare: summary.tollFare || 0, // 톨비
  };

  console.log("분기점 안내 정보: " + guideDetails.value[0].type);
  console.log("전체 경로 거리: " + totalDetails.value.totalDistance);
  console.log("전체 경로 시간: " + totalDetails.value.totalDuration);
console.log("totalDetails 값 설정:", totalDetails.value);
isDataLoaded.value = true;
console.log("isDataLoaded 상태:", isDataLoaded.value);

}


// 좌표 값 확인 함수
function isValidCoordinate(coord) {
  return coord && coord.x !== undefined && coord.y !== undefined;
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


// 폴리라인을 그리는 함수
function drawPolyline() {
  if(!directionObject.value.route.traoptimal.length) {
    console.log("폴리라인을 그릴 경로 데이터가 없습니다.");
    return;
  }

    // 1. 기존 폴리라인 삭제
    if (existingPolyline) {
    existingPolyline.setMap(null); // 지도에서 기존 폴리라인 제거
    existingPolyline = null; // 참조 초기화
  }

  // 2. 경로 데이터 가져오기
  const path = directionObject.value.route.traoptimal[0].path.map(
    ([lng,lat]) => new window.naver.maps.LatLng(lat, lng) // 경도, 위도를 LatLng 형식으로 변환
  );

  console.log("폴리라인 경로 데이터:", path);

  // 3. 폴리라인 옵션 설정 및 생성
  const polylineOptions = {
  map: map,
  path: path, // 경로 좌표
  strokeColor: '#E16E79', // 색상 값을 올바르게 HEX 형식으로 수정
  strokeOpacity: 0.9, // 선 투명도
  strokeWeight: 4, // 선 굵기
};
  existingPolyline = new window.naver.maps.Polyline(polylineOptions);

  // 3. 경로 좌표를 기반으로 지도 영역 조정
  const bounds = new window.naver.maps.LatLngBounds();
  path.forEach((latLng) => bounds.extend(latLng)); // 모든 경로 좌표를 포함하도록 bounds 확장
  map.fitBounds(bounds); // 자동으로 출발, 도착 지도 범위 조정 (네이버 API 제공)


}

</script>
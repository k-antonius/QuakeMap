'use strict';

const MAPS_URL = 'https://maps.googleapis.com/' +
                 'maps/api/js?key=AIzaSyB1rdDMZkmaoj_OINNgctPths_KJn1lTPg';

$.getScript(MAPS_URL, initMap)
  .fail((e)=> {
  console.log(e + ' failed to load maps API');
  });

class EarthQuakeModel {
  constructor(geoJSON) {
    this.name = geoJSON.properties.place;
    this.magnitude = geoJSON.properties.mag;
    let coordinates = geoJSON.geometry.coordinates;
    this.latLon = {lat: coordinates[1], lng: coordinates[0]};
    this.depth = coordinates[2];
    this.time = geoJSON.properties.time;
  }
}

class QuakeTitlePlaceModel {
  constructor(name, location) {
    this.latLon = location;
    this.name = name;
  }
}

class AbstractMarker {
  constructor(entityToMark, map) {
    this.entity = entityToMark;
    this.marker = new google.maps.Marker({
      position: entityToMark.latLon,
      map: map,
      animation: google.maps.Animation.DROP});
    this.map = map;
    this.infoWindow = new google.maps.InfoWindow();
    this.marker.addListener('click', () => {
      this.bounceMarker();
    });
  }

  removeMarker() {
    this.marker.setMap(null);
    this.marker = null;
  }

  panAndZoom() {
    this.map.setCenter(this.marker.position);
    this.map.setZoom(11);
  }

  bounceMarker() {
    this.marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(()=>{
      this.marker.setAnimation(null);
      this.openInfoWindow();
    }, 1400);
  }

  openInfoWindow() {
    this.infoWindow.open(this.map, this.marker);
  }

  closeInfoWindow() {
    this.infoWindow.close();
  }
}

class QuakeMarker extends AbstractMarker {
  constructor(earthQuake, map) {
    super(earthQuake, map);
    let contentString = '<div id="quakeInfoWindow">' +
      `<div>Where: ${this.entity.name}</div>` +
      `<div>Magnitude: ${this.entity.magnitude}</div>` +
      `<div>Depth: ${this.entity.depth}</div>` +
      `<div>When: ${this.formatDate()}</div>` +
      '</div>';
    this.infoWindow.setContent(contentString);
  }

  formatDate() {
    const time = this.entity.time;
    const options = {weekday: 'short', year: 'numeric', month: 'short',
      day: '2-digit'};
    let formatted = new Date(time);
    return formatted.toLocaleDateString('en-US', options);

  }
}

class PlaceMarker extends AbstractMarker {
  constructor(placeTitleObj, map){
    super(placeTitleObj, map);
    this.populateInfoWindow(this.entity.name);
  }

  // gets wikipedia artiles given place title
  // results are a 2d array [name, description, article link] where the first
  // array entry in the outer array is the search name
  async getWikipediaArticles(title) {
    return $.ajax( {
      url: 'https://en.wikipedia.org/w/api.php',
      data: {
        action: 'opensearch',
        search: title,
        limit: '5',
        format: 'json',
        origin: '*'
      },
      dataType: 'json'
    });
  }

  // template individual list item for info window
  buildInfoNode(title, description, link) {
    let item = '<li>' +
    `<a href="${link}"><strong>${title}:</strong></a><br>${description}` +
    '</li>';
    return item;
  }

  // create full template given array of <li> elements
  assembleTemplate(templatedListItems) {
    let openTags = '<div id="quakePlaceArticles"> <ol>';
    let closeTags = '</ol> </div>';
    return openTags.concat(templatedListItems).concat(closeTags);
  }

  // get wikipedia articles and populate template with results
  async parseResults(title) {
    try {
      let results = await this.getWikipediaArticles(title);
      // if results[1] is len 0, return a string
      if (results[1].length === 0) {
        return '<br><div><em>No results found.</em></div>';
      }
      else {
        let li_array = [];
        for (let i=0; i < results[1].length; i++) {
          let templatedListItem = this.buildInfoNode(results[1][i],
                                                     results[2][i],
                                                     results[3][i]
                                                    );
          li_array.push(templatedListItem);
        }
        return this.assembleTemplate(li_array);
      }
    }catch(error){
      console.error(error);
      return '<br><div><em>Error querying Wikipedia.</em></div>';
    }
  }

  // makes an ajax call to retrieve wikipedia articles based on this place's
  // name. Populates a html template with those articles. Sets the content of
  // this infowindow.
  async populateInfoWindow(placeName) {
    let populatedTemplate = await this.parseResults(placeName);
    let title = `<div id="quakePlaceTitle">${placeName}:</div>`;
    this.infoWindow.setContent(title.concat(populatedTemplate));
  }
}

class MarkerManager {
  constructor(googleMapInstance) {
    this.quakeMarker = null;
    this.placeMarker = null;
    this.map = googleMapInstance;
    this.markers = [];
  }

  displayQuakeMarkers(loadedQuakeJSON) {
    if (this.markers) {
      this.markers.forEach(marker => {
        marker.removeMarker();
      });
      this.markers = [];
    }
    loadedQuakeJSON.forEach(quake => {
      var newMarker = new QuakeMarker(quake, this.map);
      this.markers.push(newMarker);
    });
  }

  setQuakeMarker(earthQuake) {
    this.removePlaceMarker();
    if (! earthQuake) {
      this.markers.forEach(quake => {
        quake.marker.setOpacity(1.0);
        quake.closeInfoWindow();
      })
    }
    else {
      this.markers.forEach(quake => {
        if (quake.entity !== earthQuake) {
          quake.marker.setOpacity(0.3);
          quake.closeInfoWindow();
        }
        else {
          quake.marker.setOpacity(1.0);
          this.quakeMarker = quake;
          this.quakeMarker.bounceMarker();
        }
      });
    }
  }

  setPlaceMarker(placeInfo) {
    this.removePlaceMarker();
    this.placeMarker = new PlaceMarker(placeInfo, this.map);
  }

  removeQuakeMarker() {
    if (this.quakeMarker) {
      this.quakeMarker.removeMarker();
      this.placeMarker = null;
    }
  }

  removePlaceMarker() {
    if (this.placeMarker) {
      this.placeMarker.removeMarker();
      this.placeMarker = null;
    }
  }

  fitToPlaceMarker() {
    // is place marker in bounds?
    // if not expand bounds and fit map
    const placeMarkerPos = this.placeMarker.marker.position;
    const currentMapBounds = this.map.getBounds();
    if (!currentMapBounds.contains(placeMarkerPos)) {
      const expandedBounds = currentMapBounds.extend(placeMarkerPos);
      this.map.fitBounds(expandedBounds);
    }
  }

  // geocoding
  geocodeTitlePlace(quake) {
    let titlePlace = this.parseTitle(quake.name);
    let geocoder = new google.maps.Geocoder();
    let geoParams = {address: titlePlace, bounds: this.map.getBounds()};
      geocoder.geocode(geoParams, (result, status) => {
        if (status == 'OK') {
          let location = result[0].geometry.location;
          let quakeTitlePlace = new QuakeTitlePlaceModel(titlePlace, location);
          console.log(result);
          console.log(status);
          this.setPlaceMarker(quakeTitlePlace);
          this.fitToPlaceMarker();
        }
        else {
          alert('Unable to find nearby location. Error was ' + status);
        }
      });
  }

  // parse earthquake title
  parseTitle(name) {
    const ofString = ' of '; // because of the formatting of the title
    const title = name;
    if (title.includes(ofString)) {
      const ofIdx = title.indexOf(ofString);
      return title.substring(ofIdx + ofString.length);
    }
    else {
      return title;
    }
  }
}

// viewmodel for the map controls
function ControlViewModel() {
  var self = this;
  self.map = null;
  self.loadedQuakes = [];
  self.visibleQuakes = ko.observableArray();
  // types of available earthquake feeds from USGS.gov
  self.feedTypes = ["significant", "4.5", "2.5", "1.0", "all"];
  self.feedTimeHorizons = ["hour", "day", "week", "month"];
  // use significant and week as default feed when app loads
  self.curFeedType = ko.observable("4.5");
  self.curFeedTimeHorizon = ko.observable("week");

  self.currentQuake = ko.observable(false);
  self.markerManager = null;

  // self.quakeTitlePlace = ko.observable(false);

  self.setCurrentQuake = function(earthQuake) {
    earthQuake === self.currentQuake() ? self.currentQuake(false) :
    self.currentQuake(earthQuake);
  }

  self.currentQuake.subscribe(()=> {
    self.markerManager.setQuakeMarker(self.currentQuake());
  });

  self.showQuakeDetail = async function () {
    if (self.currentQuake()) {
      self.markerManager.quakeMarker.panAndZoom();
      self.markerManager.geocodeTitlePlace(self.currentQuake());
    }
  }

  function setVisibleQuakes (bounds, quakesToFilter) {
    self.visibleQuakes(quakesToFilter.filter(quake => {
      return bounds.contains(quake.latLon);
    }));
  }

  self.updateVisibleQuakes = function(bounds) {
    setVisibleQuakes(bounds, self.loadedQuakes);
  }

  // Generate a url for the desired earthquake feed
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`;
   return baseFeedUrl;
  }

  // load quakes from USGS and create new model objects
  async function getQuakeFeed() {
    try {
      let feed = await $.getJSON(self.generateFeedUrl());
      return feed;
    }catch(error) {
      console.log('geoJSON retrieval failed');
      console.log(error);
    }
  }

  self.populateQuakeModel = async function() {
    let feedResults = await getQuakeFeed();
    let newQuakes = [];
    feedResults.features.forEach(feature => {
      newQuakes.push(new EarthQuakeModel(feature));
    });
    return newQuakes;
  }

  self.updateQuakeFeed = async function() {
    if (self.map) {
      try {
        let newQuakes = await self.populateQuakeModel();
        self.loadedQuakes = newQuakes;
        self.markerManager.displayQuakeMarkers(newQuakes);
        let bounds = await self.map.getBounds();
        if (bounds !== undefined) {
          self.updateVisibleQuakes(bounds);
        }
      }catch(error) {
        alert('Failed to load quakes feed.');
        console.error(error);
      }

    }
  }

  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.updateQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.updateQuakeFeed, null);

  function checkMapError() {
    setTimeout(() => {
      try {
        self.map.getBounds();
      }catch(e) {
        console.log('maps failed to load');
        console.log(e);
        alert('Failed to load map.');
      }
    }, 5000);
  };

checkMapError()
}

var controlViewModel = new ControlViewModel();

// create a new Google Map
function initMap() {
  function createMap() {
    return new Promise(function(resolve, reject){
      let map = new google.maps.Map(document.getElementById('map_container'), {
        center: {lat: 36, lng: -96},
        zoom: 4
      });
      resolve(map);
      reject(Error("failed to load map"));
    });
  }

  createMap().then(map => {
    // do stuff with the map
    controlViewModel.map = map;
    controlViewModel.markerManager = new MarkerManager(map);
    controlViewModel.updateQuakeFeed();
    // listener to let UI know that map bounds have changed
    map.addListener('idle', function() {
      let bounds = map.getBounds();
      controlViewModel.updateVisibleQuakes(bounds, null);
    });
  }, error => {
    // handle the error
    console.error("Failed to load map.", error);
  });


}

ko.applyBindings(controlViewModel);

'use strict';
var map;

class earthQuakeModel {
  constructor(geoJSON) {
    this.name = geoJSON.properties.place;
    this.magnitude = geoJSON.properties.mag;
    let coordinates = geoJSON.geometry.coordinates;
    this.latLon = {lat: coordinates[1], lng: coordinates[0]};
    this.depth = coordinates[2];
    this.time = geoJSON.properties.time;
  }
}

class MarkerManager {
  constructor() {
    this.quakeMarker = null;
    this.placeMarker = null;
  }

  createMarker(earthQuake) {
    return new google.maps.Marker({
      position: earthQuake.latLon,
      map: map});
  }

  addQuakeMarker(earthQuake) {
    if (this.quakeMarker) {
      this.removeQuakeMarker();
    }
    this.quakeMarker = this.createMarker(earthQuake);
  }

  addPlaceMarker(placeInfo) {
    if (this.placeMarker) {
      this.removePlaceMarker();
    }
    this.placeMarker = createMarker(placeInfo);
  }

  removeQuakeMarker() {
    if (this.quakeMarker) {
      this.quakeMarker.setMap(null);
      this.placeMaker = null;
    }
  }

  removePlaceMarker() {
    if (this.placeMarker) {
      this.placeMarker.setMap(null);
      this.placeMaker = null;
    }
  }
}

// viewmodel for the map controls
function ControlViewModel() {
  var self = this;
  self.loadedQuakes = [];
  self.visibleQuakes = ko.observableArray();

  // types of available earthquake feeds from USGS.gov
  self.feedTypes = ["significant", "4.5", "2.5", "1.0", "all"];
  self.feedTimeHorizons = ["hour", "day", "week", "month"];

  // use significant and week as default feed when app loads
  self.curFeedType = ko.observable("significant");
  self.curFeedTimeHorizon = ko.observable("week");

  self.markerManager = new MarkerManager();
  
  // method that removes quakes from observable array as map bounds
  // change
  self.updateVisibleQuakes = function updateVisibleQuakes(mapBounds) {

    // predicate helper function
    function isQuakeOnMap(earthQuake) {
      return mapBounds.contains(earthQuake.latLon);
    }

    self.visibleQuakes(self.loadedQuakes.filter(isQuakeOnMap));
  }

  // Generate a url for the desired earthquake feed
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`;
   return baseFeedUrl;
  }

  // the quake to be displayed in viewing area
  self.currentQuake = ko.observable(false);

  self.setCurrentQuake = function(earthQuake) {
    // console.log(earthQuake)
    self.currentQuake(earthQuake);
  }

  // marker appears on map when earthquake title is clicked
  self.currentQuake.subscribe(()=> {
    self.markerManager.addQuakeMarker(self.currentQuake());
  });

  // get earthquakes from feed
  self.getQuakeFeed = function() {
    $.getJSON(self.generateFeedUrl(), function(data) {
      self.loadedQuakes = [];
      for (var i = 0; i < data.features.length; i++) {
       self.loadedQuakes.push(new earthQuakeModel(data.features[i]));
      };
    });
  }

  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.getQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.getQuakeFeed, null);
  // call for inital setup
  self.getQuakeFeed();

}

// instatiate before passing to applyBindings so that
// methods are available to initMap function
var controlViewModel = new ControlViewModel();

// create a new Google Map
function initMap() {
  map = new google.maps.Map(document.getElementById('map_container'), {
    center: {lat: 0, lng: 0},
    zoom: 3
  });

  // listener to let UI know that map bounds have changed
  map.addListener('idle', function() {
    let boundsLatLng = map.getBounds();
    controlViewModel.updateVisibleQuakes(boundsLatLng);
  });
}

ko.applyBindings(controlViewModel);

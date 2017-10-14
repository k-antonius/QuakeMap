'use strict';

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

class AbstractMarker {
  constructor(entityToMark, map) {
    this.entity = entityToMark;
    this.marker = new google.maps.Marker({
      position: entityToMark.latLon,
      map: map});
    this.map = map;
  }

  removeMarker() {
    this.marker.setMap(null);
    this.marker = null;
  }
}

class QuakeMarker extends AbstractMarker {
  constructor(earthQuake, map) {
    super(earthQuake, map);
    let contentString = '<div id="quakeInfoWindow">' +
      `<div>Where: ${this.entity.name}</div>` +
      `<div>Magnitude: ${this.entity.magnitude}</div>` +
      `<div>Depth: ${this.entity.depth}</div>` +
      `<div>When: ${this.entity.time}</div>` +
      '</div>';
    this.infoWindow = new google.maps.InfoWindow({
      content: contentString
    });
    this.marker.addListener('click', () => {
      this.infoWindow.open(this.map, this.marker);
    });
  }
}

class MarkerManager {
  constructor(googleMapInstance) {
    this.quakeMarker = null;
    this.placeMarker = null;
    this.map = googleMapInstance;
  }

  setQuakeMarker(earthQuake) {
    this.removeQuakeMarker();
    this.quakeMarker = new QuakeMarker(earthQuake, this.map);
  }

  // setPlaceMarker(placeInfo) {
  //   this.placeMarker = createMarker(placeInfo, this.map);
  // }

  removeQuakeMarker() {
    if (this.quakeMarker) {
      this.quakeMarker.removeMarker();
      this.placeMaker = null;
    }
  }

  // removePlaceMarker() {
  //   if (this.placeMarker) {
  //     this.placeMarker.setMap(null);
  //     this.placeMaker = null;
  //   }
  // }
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
  self.curFeedType = ko.observable("significant");
  self.curFeedTimeHorizon = ko.observable("week");

  self.currentQuake = ko.observable(false);
  self.markerManager = null;

  self.setCurrentQuake = function(earthQuake) {
    self.currentQuake(earthQuake);
  }

  self.currentQuake.subscribe(()=> {
    self.markerManager.setQuakeMarker(self.currentQuake());
  });

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
    return $.getJSON(self.generateFeedUrl());
  }

  self.populateQuakeModel = async function() {
    let feedResults = await getQuakeFeed();
    let newQuakes = [];
    feedResults.features.forEach(feature => {
      newQuakes.push(new earthQuakeModel(feature));
    });
    return newQuakes;
  }

  self.updateQuakeFeed = async function() {
    if (self.map) {
      let newQuakes = await self.populateQuakeModel();
      self.loadedQuakes = newQuakes;
      self.updateVisibleQuakes(self.map.getBounds());
    }
  }

  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.updateQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.updateQuakeFeed, null);
  // call for inital setup
  self.updateQuakeFeed();
}

var controlViewModel = new ControlViewModel();

// create a new Google Map
function initMap() {
  let map = new google.maps.Map(document.getElementById('map_container'), {
    center: {lat: 0, lng: 0},
    zoom: 3
  });

  controlViewModel.map = map;
  controlViewModel.markerManager = new MarkerManager(map);
  // listener to let UI know that map bounds have changed
  map.addListener('idle', function() {
    let bounds = map.getBounds();
    controlViewModel.updateVisibleQuakes(bounds, null);
  });
}

ko.applyBindings(controlViewModel);

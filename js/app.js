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
  self.markerManager = new MarkerManager();

  // called from data binding to update current quake
  self.setCurrentQuake = function(earthQuake) {
    self.currentQuake(earthQuake);
  }

  // marker appears on map when earthquake title is clicked
  self.currentQuake.subscribe(()=> {
    self.markerManager.addQuakeMarker(self.currentQuake());
  });

  self.updateVisibleQuakes = function(bounds, loadedQuakes) {

    function setVisibleQuakes (quakesToFilter) {
      // self.visibleQuakes(quakesToFilter.filter(quake => {
      //   return bounds.contains(quake.latLon);
      // }));
      console.log('in SetVisibleQuakes');
      console.log(quakesToFilter);
      self.visibleQuakes.removeAll();
      for (let i=0; i < quakesToFilter.length; i++) {
        console.log('in loop');
        let curQuake = quakesToFilter[i];
        if (bounds.contains(curQuake)) {
          self.visibleQuakes.push(quakesToFilter[i]);
        }
        else {
          console.log("not in bounds");
        }
      }
    }

    if (loadedQuakes) {
      console.log('taking branch from arg');
      console.log(loadedQuakes);
      setVisibleQuakes(loadedQuakes);
    }
    else {
      setVisibleQuakes(self.loadedQuakes);
    }
  }

  // Generate a url for the desired earthquake feed
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`;
   return baseFeedUrl;
  }



  async function getQuakeFeed() {
    let loadedQuakes = [];
    $.getJSON(self.generateFeedUrl(), function(data) {
      for (var i = 0; i < data.features.length; i++) {
       loadedQuakes.push(new earthQuakeModel(data.features[i]));
      };
    });
    return loadedQuakes;
  }

  /**
  * @description After a UI update changes the USGS feed,
  * this function loads the new geoJSON and updates the earthquakes
  * listed in the UI.
  */
  self.updateQuakeFeed = async function() {
    if (self.map) {
      let loadedQuakes = getQuakeFeed();
      loadedQuakes.then(result => {
        self.updateVisibleQuakes(self.map.getBounds(), result);
        self.loadedQuakes = result;
      });
    }
  }

  // get earthquakes from feed


  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.updateQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.updateQuakeFeed, null);
  // call for inital setup
  self.updateQuakeFeed();

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
  controlViewModel.map = map;
  // listener to let UI know that map bounds have changed
  map.addListener('idle', function() {
    let bounds = map.getBounds();
    controlViewModel.updateVisibleQuakes(bounds, null);
  });
}

ko.applyBindings(controlViewModel);

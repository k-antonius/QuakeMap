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
      this.infoWindow.open(this.map, this.marker);
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
    let results = await this.getWikipediaArticles(title);
    console.log(results);
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

  // makes an ajax call to retrieve wikipedia articles based on this place's
  // name. Populates a html template with those articles. Sets the content of
  // this infowindow.
  async populateInfoWindow(placeName) {
    console.log('this place\'s name is ' + placeName);
    let populatedTemplate = await this.parseResults(placeName);
    let title = `<div id="quakePlaceTitle">${placeName}:</div>`;
    console.log(title.concat(populatedTemplate));
    this.infoWindow.setContent(title.concat(populatedTemplate));
  }
}

class MarkerManager {
  constructor(googleMapInstance) {
    this.quakeMarker = null;
    this.placeMarker = null;
    this.map = googleMapInstance;
  }

  setQuakeMarker(earthQuake) {
    this.removePlaceMarker();
    this.removeQuakeMarker();
    this.quakeMarker = new QuakeMarker(earthQuake, this.map);
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
        let location = result[0].geometry.location;
        let quakeTitlePlace = new QuakeTitlePlaceModel(titlePlace, location);
        console.log(result);
        console.log(status);
        this.setPlaceMarker(quakeTitlePlace);
        this.fitToPlaceMarker();
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
  self.curFeedType = ko.observable("significant");
  self.curFeedTimeHorizon = ko.observable("week");

  self.currentQuake = ko.observable(false);
  self.markerManager = null;

  // self.quakeTitlePlace = ko.observable(false);

  self.setCurrentQuake = function(earthQuake) {
    self.currentQuake(earthQuake);
  }

  self.currentQuake.subscribe(()=> {
    self.markerManager.setQuakeMarker(self.currentQuake());
  });

  self.showQuakeDetail = async function () {
    self.markerManager.quakeMarker.panAndZoom();
    self.markerManager.geocodeTitlePlace(self.currentQuake());
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
      let newQuakes = await self.populateQuakeModel();
      self.loadedQuakes = newQuakes;
      self.updateVisibleQuakes(self.map.getBounds());
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
      }
    }, 5000);
  };

checkMapError()
}

var controlViewModel = new ControlViewModel();

// create a new Google Map
function initMap() {
  let map = new google.maps.Map(document.getElementById('map_container'), {
    center: {lat: 36, lng: -96},
    zoom: 4
  });

  controlViewModel.map = map;
  controlViewModel.markerManager = new MarkerManager(map);
  controlViewModel.updateQuakeFeed();
  // listener to let UI know that map bounds have changed
  map.addListener('idle', function() {
    let bounds = map.getBounds();
    controlViewModel.updateVisibleQuakes(bounds, null);
  });
}

ko.applyBindings(controlViewModel);

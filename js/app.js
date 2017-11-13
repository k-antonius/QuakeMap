'use strict';

// Google Maps API URL
const MAPS_URL = 'https://maps.googleapis.com/' +
                 'maps/api/js?key=AIzaSyB1rdDMZkmaoj_OINNgctPths_KJn1lTPg';


/**
 * Loads Google maps script.
 */
$.getScript(MAPS_URL, initMap)
  .fail((e)=> {
  console.log(e + ' failed to load maps API');
  alert('Failed to load map.');
  });


/**
 * Class to store information about earthquakes from USGS.gov
 */
class EarthQuakeModel {

  /**
   * constructor - Create a new EarthQuakeModelObject.
   * name - the name of the place near where the earthquake occurred.
   * magnitude - the magnitude of the earthquake
   * latLon - the location of the earthquake in latitude and longitude
   * depth - the depth of the earthquake
   * time - when the earthquake occurred
   *
   * @param  {object} geoJSON object matching the geoJSON standard
   * @return None.
   */
  constructor(geoJSON) {
    this.name = geoJSON.properties.place;
    this.magnitude = geoJSON.properties.mag;
    let coordinates = geoJSON.geometry.coordinates;
    this.latLon = {lat: coordinates[1], lng: coordinates[0]};
    this.depth = coordinates[2];
    this.time = geoJSON.properties.time;
  }
}


/**
 * Class to store information about a place close to where an earthquake
 * happened.
 */
class QuakeTitlePlaceModel {

  /**
   * constructor - description
   *
   * @param  {string} name     the name of the place, which is derived from
   * an EarthQuakeModel name field.
   * @param  {object} location a LatLng object literal
   * @return None.
   */
  constructor(name, location) {
    this.latLon = location;
    this.name = name;
  }
}


/**
 * Class to represent common fields for QuakeMarker and PlaceMarker objects.
 * Should not be directly instantiated.
 */
class AbstractMarker {

  /**
   * constructor - Should only be used in subclasses.
   *
   * @param  {Model} entityToMark EarthQuakeModel or QuakeTitlePlaceModel
   * @param  {Map} map          Google Map instance
   * @return None.
   */
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

  /**
   * removeMarker - remove this marker from the map and remove its reference.
   *
   * @return None.
   */
  removeMarker() {
    this.marker.setMap(null);
    this.marker = null;
  }

  /**
   * panAndZoom - Center the map on this marker and zoom in.
   *
   * @return None.
   */
  panAndZoom() {
    this.map.setCenter(this.marker.position);
    this.map.setZoom(11);
  }

  /**
   * bounceMarker - Animate this marker with a bounce and then open its
   * infowindow.
   *
   * @return None.
   */
  bounceMarker() {
    this.marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(()=>{
      this.marker.setAnimation(null);
      this.openInfoWindow();
    }, 1400);
  }

  /**
   * openInfoWindow - Open this marker's infowindow.
   *
   * @return None.
   */
  openInfoWindow() {
    this.infoWindow.open(this.map, this.marker);
  }

  /**
   * closeInfoWindow - Close this marker's infowindow.
   *
   * @return None.
   */
  closeInfoWindow() {
    this.infoWindow.close();
  }
}


/**
 * Class to represent a marker for an earthquake. Subclass of Abstract Marker.
 */
class QuakeMarker extends AbstractMarker {

  /**
   * constructor - Create a new earthquake marker and set up its infowindow.
   *
   * @param  {EarthQuakeModel} earthQuake EarthQuakeModel object associated
   * with this marker.
   * @param  {Map} map        Google Map instance for this marker
   * @return None.
   */
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

  /**
   * formatDate - Formats the EarthQuakeModel's time field into a
   * human-readable date string.
   *
   * @return {string}  Date in the human readable format.
   */
  formatDate() {
    const time = this.entity.time;
    const options = {weekday: 'short', year: 'numeric', month: 'short',
      day: '2-digit'};
    let formatted = new Date(time);
    return formatted.toLocaleDateString('en-US', options);

  }
}


/**
 * Class to represent a marker whose location is a notable place near a
 * recent earthquake. Subclass of AbstractMarker.
 */
class PlaceMarker extends AbstractMarker {

  /**
   * constructor - Create a new PlaceMarker.
   *
   * @param  {QuakeTitlePlaceModel} placeTitleObj object with location and
   * name of this place
   * @param  {MAP} map the Google Map instance on which to place this marker
   * @return None.
   */
  constructor(placeTitleObj, map){
    super(placeTitleObj, map);
    this.populateInfoWindow(this.entity.name);
  }

  /**
   * async getWikipediaArticles - Perform a Wikipedia article search for the
   * input string.
   *
   * @param  {string} title The title of this place marker
   * @return {array} [[query string], [article names],
   * [descriptions], [links to articles]]
   */
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

  /**
   * buildInfoNode - Populate an html template for a list item DOM element
   * to display a single Wikipedia search result.
   *
   * @param  {string} title       the name of this location
   * @param  {string} description description of this location
   * @param  {string} link        complete URL string
   * @return {string} a complete list item node
   */
  buildInfoNode(title, description, link) {
    let item = '<li>' +
    `<a href="${link}"><strong>${title}:</strong></a><br>${description}` +
    '</li>';
    return item;
  }

  /**
   * assembleTemplate - Take an array of <li> strings and return a complete
   * <div> DOM node that will be the content of this marker's infowindow.
   *
   * @param  {array} templatedListItems array of <li> strings
   * @return {string} <div> element string
   */
  assembleTemplate(templatedListItems) {
    let openTags = '<div id="quakePlaceArticles"> <ol>';
    let closeTags = '</ol> </div>';
    return openTags.concat(templatedListItems).concat(closeTags);
  }

  /**
   * async parseResults - Make an AJAX request to Wikipedia using the open
   * search protocol for articles relating to this place's title. Populate and
   * return an infowindow div with the resulting information. Errors in the
   * AJAX request or a failure to locate any articles will be displayed in
   * the infowindow.
   *
   * @param  {string} title The title of the place this marker indicates.
   * @return {string} string <div> element for insertion as infowindow
   * content.
   */
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

  /**
   * async populateInfoWindow - Populates this Place Marker's infowindow with
   * information from a Wikipedia query using its entity name field.
   * @param  {string} placeName The entity name field.
   * @return None.
   */
  async populateInfoWindow(placeName) {
    let populatedTemplate = await this.parseResults(placeName);
    let title = `<div id="quakePlaceTitle">${placeName}:</div>`;
    this.infoWindow.setContent(title.concat(populatedTemplate));
  }
}


/**
 * Class to handle the creation, removal, and display of Quake and Place
 * Marker objects on the Google Map.
 */
class MarkerManager {

  /**
   * constructor - Create a new MarkerManager.
   *
   * @param  {Map} googleMapInstance The google map instance for this app.
   * @return None.
   */
  constructor(googleMapInstance) {
    this.quakeMarker = null;
    this.placeMarker = null;
    this.map = googleMapInstance;
    this.markers = [];
  }

  /**
   * displayQuakeMarkers - Takes an array of EarthQuakeModels and creates a new
   * QuakeMarker for each, storing them in the this.markers array. If the
   * field already contains markers, each marker is destroyed before the array
   * is repopulated.
   *
   * @param  {EarthQuakeModel} earthQuakeModelList list of model objects
   * @return None.
   */
  displayQuakeMarkers(earthQuakeModelList) {
    if (this.markers) {
      this.markers.forEach(marker => {
        marker.removeMarker();
      });
      this.markers = [];
    }
    earthQuakeModelList.forEach(quake => {
      var newMarker = new QuakeMarker(quake, this.map);
      this.markers.push(newMarker);
    });
  }


  /**
   * setQuakeMarker - Sets the active marker on the map. The active marker is
   * completely opaque. All other markers are mostly transparent. Calling this
   * method on the earthquake that is already the active marker unsets that
   * marker, making all markers on the map fully opaque.
   *
   * @param  {EarthQuakeModel or boolean} earthQuake the earthquake to set as
   * current. Pass 'false' to unset the current. Passing true will cause an
   * error.
   * @return None.
   */
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

  /**
   * setPlaceMarker - Set the input QuakeTitlePlaceModel object as the current
   * place marker and create a new PlaceMarker on the map. If there is already
   * a place marker set in this MarkerManager, the old one is removed from the
   * map and destroyed before the new one is created.
   *
   * @param  {QuakeTitlePlaceModel} placeInfo The QuakeTitlePlaceModel object
   * to mark
   * @return None.
   */
  setPlaceMarker(placeInfo) {
    this.removePlaceMarker();
    this.placeMarker = new PlaceMarker(placeInfo, this.map);
  }

  // TODO Can be deleted?
  removeQuakeMarker() {
    if (this.quakeMarker) {
      this.quakeMarker.removeMarker();
      this.placeMarker = null;
    }
  }

  /**
   * removePlaceMarker - Remove the currently set placeMarker, if one is set.
   * Removes the marker from the map and removes its reference.
   *
   * @return None.
   */
  removePlaceMarker() {
    if (this.placeMarker) {
      this.placeMarker.removeMarker();
      this.placeMarker = null;
    }
  }

  /**
   * fitToPlaceMarker - Adjusts the pan/zoom level of the map so that it will
   * contain the placeMarker, if it does not already.
   *
   * @return None.
   */
  fitToPlaceMarker() {
    const placeMarkerPos = this.placeMarker.marker.position;
    const currentMapBounds = this.map.getBounds();
    if (!currentMapBounds.contains(placeMarkerPos)) {
      const expandedBounds = currentMapBounds.extend(placeMarkerPos);
      this.map.fitBounds(expandedBounds);
    }
  }

  /**
   * geocodeTitlePlace - Given an EarthQuakeModel, geocode the place that its
   * title refers to, create a new QuakeTitlePlaceModel for that location,
   * and set a marker corresponding to that place on the map. The map will pan
   * and zoom as necessary to fit the new Marker. Errors in the geocoding
   * request are handled by displaying an alert.
   *
   * @param  {EarthQuakeModel} quake The earthquake the title of which to mark
   * on the map.
   * @return None.
   */
  geocodeTitlePlace(quake) {
    let titlePlace = this.parseTitle(quake.name);
    let geocoder = new google.maps.Geocoder();
    let geoParams = {address: titlePlace, bounds: this.map.getBounds()};
      geocoder.geocode(geoParams, (result, status) => {
        if (status == 'OK') {
          let location = result[0].geometry.location;
          let quakeTitlePlace = new QuakeTitlePlaceModel(titlePlace, location);
          this.setPlaceMarker(quakeTitlePlace);
          this.fitToPlaceMarker();
        }
        else {
          alert('Unable to find nearby location. Error was ' + status);
        }
      });
  }

  /**
   * parseTitle - Removes the extraneous parts of the earthquake title string
   * so that it can be used to geocode for the place referred to in the title.
   *
   * @param  {string} name The name field of a QuakeTitlePlaceModel
   * @return {string} String formatted to be the subject of a geocoding
   * request.
   */
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


/**
 * ControlViewModel - Knockout.js ViewModel for the control bar.
 */
function ControlViewModel() {
  var self = this;
  self.map = null; // google map instance
  self.loadedQuakes = []; // quakes loaded from USGS, EarthQuakeModel objects
  self.visibleQuakes = ko.observableArray(); // quakes in map viewport
  // types of available earthquake feeds from USGS.gov
  self.feedTypes = ["significant", "4.5", "2.5", "1.0", "all"]; // magnitude
  self.feedTimeHorizons = ["hour", "day", "week", "month"]; // time
  // the the default feed types
  self.curFeedType = ko.observable("4.5");
  self.curFeedTimeHorizon = ko.observable("week");

  self.currentQuake = ko.observable(false); // the quake currently selected
  self.markerManager = null; // MarkerManager instance

  // TODO remove this?
  // self.quakeTitlePlace = ko.observable(false);

  /**
   * self.setCurrentQuake - Sets the active EarthQuakeModel in the UI. If the
   * quake to be set is already the current quake, the current status is
   * removed and there is not current quake. The
   *
   * @param  {EarthQuakeModel} earthQuake the earthquake to set as current
   * @return None.
   */
  self.setCurrentQuake = function(earthQuake) {
    earthQuake === self.currentQuake() ? self.currentQuake(false) :
    self.currentQuake(earthQuake);
  }

  // When the current quake is changed, the marker manager instance updates
  // its active QuakeMarker.
  self.currentQuake.subscribe(()=> {
    self.markerManager.setQuakeMarker(self.currentQuake());
  });

  /**
   * self.showQuakeDetail - Zoom in and center on the current quake and then
   * geocode and add a marker for the location its title refers to.
   *
   * @return None.
   */
  self.showQuakeDetail = async function () {
    if (self.currentQuake()) {
      self.markerManager.quakeMarker.panAndZoom();
      self.markerManager.geocodeTitlePlace(self.currentQuake());
    }
  }

  /**
   * setVisibleQuakes - Updates the contents of the visible quakes observable
   * to be the quakes that are within the bounds of the google map viewport.
   *
   * @param  {LatLngBounds} bounds Current map bounds
   * @param  {array} quakesToFilter currently loaded EarthQuakeModels
   * @return None.
   */
  function setVisibleQuakes (bounds, quakesToFilter) {
    self.visibleQuakes(quakesToFilter.filter(quake => {
      return bounds.contains(quake.latLon);
    }));
  }

  // TODO Unnecessary function wrapping here -- combine with setVisibleQuakes
  self.updateVisibleQuakes = function(bounds) {
    setVisibleQuakes(bounds, self.loadedQuakes);
  }

  /**
   * self.generateFeedUrl - builds a url to use to request geoJSON from
   * USGS.gov. The URL depends upon the current value of the curFeedType and
   * curFeedTimeHorizon observables.
   *
   * @return {string}  the url to use to make an AJAX request to USGS.gov
   */
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`; // TODO fix line continuation
   return baseFeedUrl;
  }

  /**
   * getQuakeFeed - Make an AJAX request to USGS for a geoJSON response based
   * on the current value of the feed observables.
   *
   * @return {object} geoJSON response object
   */
  async function getQuakeFeed() {
    try {
      let feed = await $.getJSON(self.generateFeedUrl());
      return feed;
    }catch(error) {
      console.log('geoJSON retrieval failed');
      console.error(error);
    }
  }

  /**
   * self.populateQuakeModel - Make an AJAX request for geoJSON and parse the
   * results creating a new EarthQuakeModel object for each feature present.
   *
   * @return {array}  an array of EarthQuakeModel objects
   */
  self.populateQuakeModel = async function() {
    let feedResults = await getQuakeFeed();
    let newQuakes = [];
    feedResults.features.forEach(feature => {
      newQuakes.push(new EarthQuakeModel(feature));
    });
    return newQuakes;
  }

  /**
   * self.updateQuakeFeed - Populate the EarthQuakeModel with data from
   * USGS.gov, display this data on the map as markers, and update the UI list
   * with visible quakes if the map is loaded. If the AJAX request fails,
   * display an alert window.
   *
   * @return None.
   */
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

  // load new eathquake data when either feed observable updates
  self.curFeedType.subscribe(self.updateQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.updateQuakeFeed, null);


  /**
   * checkMapError - If the google map API script fails to load after a
   * significant amout of time, display an alert message.
   *
   * @return None.
   */
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
/**
 * initMap - Callback function for google map script loading. Create a new map
 * instance, pass this instance to the ViewModel, load earthquake data for
 * initial display, and add a listener to the map to let the ViewModel know
 * when the bounds of the map have changed. If the map cannot be loaded, display
 * an alert message.
 *
 * @return {type}  description
 */
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
    alert('Failed to load map.');
  });
}

ko.applyBindings(controlViewModel);

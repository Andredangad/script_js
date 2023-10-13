/**
 * @constructor
 */
var VpaidVideoPlayer = function() {
    /**
     * The slot is the div element on the main page that the ad is supposed to
     * occupy.
     * @type {Object}
     * @private
     */
    this.slot_ = null;
  
    /**
     * The video slot is the video element used by the ad to render video content.
     * @type {Object}
     * @private
     */
    this.videoSlot_ = null;
  
    /**
     * An object containing all registered events.  These events are all
     * callbacks for use by the VPAID ad.
     * @type {Object}
     * @private
     */
    this.eventsCallbacks_ = {};
  
    /**
     * A list of getable and setable attributes.
     * @type {Object}
     * @private
     */
    this.attributes_ = {
      'companions' : '',
      'desiredBitrate' : 256,
      'duration': 30,
      'expanded' : false,
      'height' : 50,
      'icons' : false,
      'linear' : true,
      'remainingTime' : 13,
      'skippableState' : false,
      'viewMode' : 'normal',
      'width' : 50,
      'volume' : 1.0
    };
  
    /**
     * @type {?number} id of the interval used to synch remaining time
     * @private
     */
    this.intervalId_ = null;
  
    /**
     * A set of events to be reported.
     * @type {Object}
     * @private
     */
    this.quartileEvents_ = [
      // {event: 'AdImpression', value: 0},
      {event: 'AdVideoStart', value: 0},
      {event: 'AdVideoFirstQuartile', value: 25},
      {event: 'AdVideoMidpoint', value: 50},
      {event: 'AdVideoThirdQuartile', value: 75},
      {event: 'AdVideoComplete', value: 100}
    ];
  
    /**
     * @type {number} An index into what quartile was last reported.
     * @private
     */
    this.lastQuartileIndex_ = 0;
  
    /**
     * An array of urls and mimetype pairs.
     *
     * @type {!object}
     * @private
     */
    this.parameters_ = {};
  };
  
  
  /**
   * VPAID defined init ad, initializes all attributes in the ad.  The ad will
   * not start until startAd is called.
   *
   * @param {number} width The ad width.
   * @param {number} height The ad heigth.
   * @param {string} viewMode The ad view mode.
   * @param {number} desiredBitrate The desired bitrate.
   * @param {Object} creativeData Data associated with the creative.
   * @param {Object} environmentVars Variables associated with the creative like
   *     the slot and video slot.
   */
  VpaidVideoPlayer.prototype.initAd = function(
      width,
      height,
      viewMode,
      desiredBitrate,
      creativeData,
      environmentVars) {
    // slot and videoSlot are passed as part of the environmentVars
    this.attributes_['width'] = width;
    this.attributes_['height'] = height;
    this.attributes_['viewMode'] = viewMode;
    this.attributes_['desiredBitrate'] = desiredBitrate;
    this.slot_ = environmentVars.slot;
    this.videoSlot_ = environmentVars.videoSlot;
  
    // Parse the incoming parameters.
    this.parameters_ = JSON.parse(creativeData['AdParameters']);

    this.log('initAd ' + width + 'x' + height +
        ' ' + viewMode + ' ' + desiredBitrate);
    this.updateVideoSlot_();
    this.videoSlot_.addEventListener(
        'timeupdate',
        this.timeUpdateHandler_.bind(this),
        false);
    this.videoSlot_.addEventListener(
        'ended',
        this.pauseAd.bind(this),
        false);
    this.videoSlot_.addEventListener(
        'play',
        this.videoResume_.bind(this),
        false);
    this.callEvent_('AdLoaded');
  };
  
  
  /**
   * Called when the overlay is clicked.
   * @private
   */
  VpaidVideoPlayer.prototype.overlayOnClick_ = function() {
    if ('AdClickThru' in this.eventsCallbacks_) {
      this.eventsCallbacks_['AdClickThru']('','0', true);
    };
  };
  
  
  /**
   * Called by the video element.  Calls events as the video reaches times.
   * @private
   */
  VpaidVideoPlayer.prototype.timeUpdateHandler_ = function() {
    this.attributes_['remainingTime'] =
        this.videoSlot_.duration - this.videoSlot_.currentTime;
    if (this.lastQuartileIndex_ >= this.quartileEvents_.length) {
      return;
    }
    var percentPlayed =
        this.videoSlot_.currentTime * 100.0 / this.videoSlot_.duration;
    if (percentPlayed >= this.quartileEvents_[this.lastQuartileIndex_].value) {
      var lastQuartileEvent = this.quartileEvents_[this.lastQuartileIndex_].event;
      this.eventsCallbacks_[lastQuartileEvent]();
      this.lastQuartileIndex_ += 1;
    }
    if (this.attributes_['duration'] != this.videoSlot_.duration) {
      this.attributes_['duration'] = this.videoSlot_.duration;
      this.callEvent_('AdDurationChange');
    }
  };
  
  
  /**
   * @private
   */
  VpaidVideoPlayer.prototype.updateVideoSlot_ = function() {
    if (this.videoSlot_ == null) {
      this.videoSlot_ = document.createElement('video');
      // this.log('Warning: No video element passed to ad, creating element.');
      this.slot_.appendChild(this.videoSlot_);
    }
    // TODO right now the sdk is sending in the wrong size on init.
    // there should be no need to change element sizes from the start.
    //this.updateVideoPlayerSize_();
    var foundSource = false;
    var videos = this.parameters_.videos || [];
    for (var i = 0; i < videos.length; i++) {
      // Choose the first video with a supported mimetype.
      if (this.videoSlot_.canPlayType(videos[i].mimetype) != '') {
        this.videoSlot_.setAttribute('src', videos[i].url);
        foundSource = true;
        break;
      }
    }
    if (!foundSource) {
      // Unable to find a source video.
      this.callEvent_('AdError');
    }
  };
  
  
  /**
   * Helper function to update the size of the video player.
   * @private
   */
  VpaidVideoPlayer.prototype.updateVideoPlayerSize_ = function() {
    try {
      this.videoSlot_.setAttribute('width', this.attributes_['width']);
      this.videoSlot_.setAttribute('height', this.attributes_['height']);
      this.videoSlot_.style.width = this.attributes_['width'] + 'px';
      this.videoSlot_.style.height = this.attributes_['height'] + 'px';
    } catch (e) { /* no op*/}
  };
  
  
  /**
   * Returns the versions of VPAID ad supported.
   * @param {string} version
   * @return {string}
   */
  VpaidVideoPlayer.prototype.handshakeVersion = function(version) {
    return ('2.0');
  };
  
  
  /**
   * Called by the wrapper to start the ad.
   */
  VpaidVideoPlayer.prototype.startAd = function() {
    this.log('Starting ad');
 ///////////// CHANGEMENT DE SOURCE AUDIO ////////////////

    var creativeDataAdm = [];
    var poiList = [{"c":"AGEN","poi":"spb7mc5cxgfp","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"AIX EN PROVENCE","poi":"speze074p4bt","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ALBI","poi":"spc9b9qetsuy","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ALENCON","poi":"u085dennpuq8","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ANGERS","poi":"gbrw1fjfn2qt","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ANGOULEME","poi":"u005uhg9gw0s","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ANNECY","poi":"u0hkccc4tj6k","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ANNEMASSE","poi":"u0hqydzb34j2","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ARLES","poi":"spg29se8wsw0","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"AUBAGNE","poi":"speyr2fjgvx3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"AUXERRE","poi":"u06xcp594zeu","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"AVIGNON","poi":"spg3yhrm1pvv","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BASTIA","poi":"spwdqtzu9zgh","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BAYONNE","poi":"ezwzjzxwem1q","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BEAUVAIS","poi":"u0c9201gzs5n","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BELFORT","poi":"u0kzh880cyk3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BESANCON","poi":"u0khx6gcfyhy","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BEZIERS","poi":"spdqd5ke9yew","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BLOIS","poi":"u02yyk2344nm","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BORDEAUX","poi":"ezzxk832b5xr","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BORDEAUX","poi":"ezzx02hqdf66","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BOULOGNE SUR MER","poi":"u110kskk4fh1","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BOURG EN BRESSE","poi":"u05wxfrztdw3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BOURGES","poi":"u03sn12y6n4u","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BOURGOIN JALLIEU","poi":"u05erdv9xr70","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BREST","poi":"gbsg6mc3xzyr","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BRIE COMTE ROBERT","poi":"u09v51v66rb8","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BRIVE LA GAILLARDE","poi":"u010c6ruuger","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"BRUAY LA BUISSIERE","poi":"u0cz68zv5p5u","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CAEN","poi":"gbxz86ugjhtv","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CANNES","poi":"spubne6g0svu","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CARCASSONNE","poi":"sp9tud85qr61","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CASTRES","poi":"sp9xfpmn0672","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CESSY","poi":"u0hr6n6ptbsg","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHALON SUR SAONE","poi":"u076ndj35ukn","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHAMBERY","poi":"u0h5mzmbbkvk","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHAMBOURCY","poi":"u09qnx4gyseh","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHANGE","poi":"u0952ynqfk6m","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHARTRES","poi":"u034pn2kcdnr","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHATEAUROUX","poi":"u0e9t44u4gsc","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHAUMONT","poi":"gbr7e1w2we6d","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CHOLET","poi":"u04hr92fm2zu","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CLERMONT FERRAND","poi":"u0t1xvv47f1q","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"COLMAR","poi":"u0ccp4743pm8","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"COMPIEGNE","poi":"u0cb0490424f","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"CREIL","poi":"ezz0z0wgmer8","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"DAX","poi":"u07t41nzps3q","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"DIJON","poi":"u0fnquts8kez","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"DOUAI","poi":"u08vq9h4npbm","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"DREUX","poi":"u11dm8wbr989","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"DUNKERQUE","poi":"u0sd5p05xm6r","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"EPINAL","poi":"u08ygj13uywd","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"EVREUX","poi":"u09grp0k9wv2","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"FONTAINEBLEAU","poi":"spsz0mfehnn6","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"FREJUS","poi":"spume42hvv5x","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"GAP","poi":"u0h0cgw5puz1","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"GRENOBLE","poi":"u0tt9dcwv33v","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"HAGUENAU","poi":"u11b96mx6wsb","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"HAZEBROUCK","poi":"gbqcz97u1h98","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LA ROCHE SUR YON","poi":"gbpnw01cjg4k","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LA ROCHELLE","poi":"gbtt1zee3zkn","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LANNION","poi":"u0fd51zexqbr","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LAON","poi":"gbx3wfwd2v42","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"Le Havre","poi":"u0b1e6kmwz1h","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LE MANS","poi":"u080v1rzbnbq","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LE PUY EN VELAY","poi":"u04b645v4pd4","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LENS","poi":"u0cyxzn8mn09","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LES ULIS","poi":"u09scvq45sk6","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LILLE","poi":"u140p54kuxev","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LIMOGES","poi":"u00vj16yfqp3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LIMONEST","poi":"u05ksd6wufep","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LONS LE SAUNIER","poi":"u07cx0c7td5e","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LORIENT","poi":"gbmxu48c137k","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"LYON","poi":"u05kn6hkpbrs","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MACON","poi":"u05rm6hhqjz9","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MARNE LA VALLEE","poi":"u09vuy8sw8r5","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MARSEILLE","poi":"speyk1nmw3qf","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MEAUX","poi":"u0dn3kng2bkz","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MELUN","poi":"u09uk18vdgk5","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"METZ","poi":"u0sr5jfpjxpu","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONACO","poi":"spv2b8y2y2fd","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONT DE MARSAN","poi":"ezz9vuh05t43","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONTARGIS","poi":"u09by5xmrtft","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONTAUBAN","poi":"spbfq2hns1b3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONTIGNY LE BRETONNE","poi":"u09mmz52w1kt","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONTPELLIER","poi":"spdzbjj456sg","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MONTROUGE","poi":"u09tszm1get1","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MORLAIX","poi":"gbtk262p2160","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"MULHOUSE","poi":"u0mpzcvcxt4h","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NANCY","poi":"u0skgxbm0u4w","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NANTES","poi":"gbqug4fkbctq","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NARBONNE","poi":"spdjefvu6wr5","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NEVERS","poi":"u065r49z3v5q","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NICE","poi":"spv0t4wqznfv","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NICE","poi":"spv0ech3fd2j","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"NIMES","poi":"spg168jkp49n","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ORLEANS","poi":"u092ejjv8zr4","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PAMIERS","poi":"sp9jjp7w2c1n","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PARIS","poi":"u09tyu2ceec2","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PARIS 15","poi":"u09tu4vy0h01","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PARIS 16","poi":"u09tg6gmtqn3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PARIS 17","poi":"u09wh6svjbhc","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PAU","poi":"ezxwqp00d3kc","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PERIGUEUX","poi":"u0094jp8m8d9","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PERPIGNAN","poi":"spd4cbhqe0nn","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"POITIERS","poi":"u020z48y1pvr","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PONTARLIER","poi":"u0kdbk1fu9dk","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"PONTOISE","poi":"u09qzrguvryd","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"QUIMPER","poi":"gbt0unvgwp6y","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"REIMS","poi":"u0fbhgjgr7er","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"RENNES","poi":"gbwcejnqdz47","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"RIVERY","poi":"u0cevq1jhwz0","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ROANNE","poi":"u04vv1sv81g7","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"RODEZ","poi":"spcu3yk02cc2","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ROISSY EN FRANCE","poi":"u09y9r7w9pxf","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ROUEN","poi":"u0bc23tp699g","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ROYAN","poi":"gbp7bbkhcd9r","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"RUEIL MALMAISON","poi":"u09w1g5234ts","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"SAINT MALO","poi":"gbw5cy9m2zty","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"SAINT NAZAIRE","poi":"u054etxv57kd","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"SAINT OUEN","poi":"gbxpr60j3jt4","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"SAINT VICTORET","poi":"gbwsdg3xdnuu","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"SARREGUEMINES","poi":"u09v8m4kfspq","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ST BRIEUC","poi":"gbqmnqcmkm8y","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ST MAUR DES FOSSES","poi":"u09wjr2c4h7m","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"ST PRIEST EN JAREZ","poi":"spexp042nmvf","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"STLO","poi":"u0tp3kxf7h30","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"STRASBOURG","poi":"u0tkxg5tkudn","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TARBES","poi":"sp8jcgyubw7r","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"THIONVILLE","poi":"u0u2snt3jz0s","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TOULON","poi":"spsm3htxnkj5","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TOULOUSE","poi":"sp9pdf7zp6hg","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TOULOUSE","poi":"spc00x9x1vms","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TOURS","poi":"u02mz4kxdy31","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"TROYES","poi":"u0dfs5qrqzwm","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VALENCE","poi":"spgx84jwbrh3","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VALENCIENNES","poi":"u0fw8v2g6yr6","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VANNES","poi":"gbqp0tg83kdk","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VELIZY VILLACOUBLAY","poi":"u09t98r9xhex","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VESOUL","poi":"u0krh06e0gc7","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VICHY","poi":"u04qmdyjbs8u","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VILLEFRANCHE SUR SAONE","poi":"u05meuv2mnhd","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VIRE","poi":"gbxmupekgu50","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"},{"c":"VIRY CHATILLON","poi":"u09syjwph181","lom1":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom2":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3","lom3":"https://assets.adotmob.com/Audi/111023/audio/AGEN+-+AUDI+JMA+A3+TFSIE+25%2B5+LOM1+29.09.23.mp3"}];

    var POIAdm = decodeURIComponent(this.parameters_.poi) || "{}";
    POIAdm = JSON.parse(POIAdm);
    var poiId = POIAdm.id;
    
    // var poiId = "u09v51v66rb8";
    var audioToUse;

    const rndInt = Math.floor(Math.random() * 3) + 1
    console.log(rndInt)
  
    function changeAudioByPoi(){
      poiList.map(function(elem){
        if(elem.poi == poiId){
          audioToUse = elem["lom"+rndInt];
        }
      })
    }

    changeAudioByPoi();

    this.videoSlot_.setAttribute('src', audioToUse);  
    this.videoSlot_.play();
    

    var videoFV = this.videoSlot_;
  
    var configAdm = this.parameters_.config || [];
    var ccCD = this.parameters_.cc || '';
   
  
    function createEvent(config){
          var allowRedirect = false; // NEED OF INFORMATION ABOUT THIS VAR
          var aElement;
          var event = {}; // events handler
          var trackerClickUrl = config.macro.url; // store url of redirection
          var trackerEventUrl; // store url of events
          var urlRedirectionDashboard = getParameterByName("r", trackerClickUrl);
          var alreadyClicked = false; // preventing from double clicking
          var pos_interact = "1_1"; // position of the last user interaction
          var constant_params = {}; // object of parameters to be sent with events
          var eventAlreadyFired = {};
          var nbCallsInUrl = 0;
          var timeStart = new Date();
          var screenX = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
          var screenY = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
      
          // Loading pixel
          // url (r) : url of the pixel
          event.loadPixel = function eventLoadPixel(url){
              url = url.replace('{TIMESTAMP}', config.macro.timestamp);
              var img = new Image();
              img.src = url;
          };
      
          // Triggering an event to the Adotmob tracker
          // eventName (r) : name of the event (can be custom)
          // eventType (r) : event type (i for user interaction, t for timing event)
          // params (o) : parameters as object
          event.trigger = function eventTrigger(eventName, eventType, params){
              var params = params || {};
              var eventType = eventType || "t";
              var url = trackerEventUrl.replace("/click?","/" + eventName + "?");
      
              // Case IF we trigger manually a click and no click has already triggered before
              // OR IF we trigger a non-click event that has never been triggered or an interaction event has already been triggered but less than 30 times
              // (if there is a timing event that is triggered a second time, it will never trigger again)
              if( (eventName === "click" && !alreadyClicked) || ( eventName !== "click" && (!(eventName in eventAlreadyFired) || (eventAlreadyFired[eventName]["et"] === "i" && eventAlreadyFired[eventName]["ni"] < 30))) ){
                  
                  // Case of an event that has never been triggered
                  if(!eventAlreadyFired[eventName]){
                      // We store the event in an object with all of its own parameters
                      eventAlreadyFired[eventName] = {"et" : eventType};
      
                      // Case of an event that is a click manually triggered to prevent from further clicks
                      if(eventName === "click"){
                          alreadyClicked = true;
                          eventAlreadyFired[eventName]["ni"] = 30;
                      }
                      // Case of an interaction event
                      else if(eventType === "i"){
                          eventAlreadyFired[eventName]["ni"] = 1;
                      }
                      // Case of an interaction event that has already been triggered
                  }else{
                      eventAlreadyFired[eventName]["ni"]++;
                  }
      
                  // Call the tracking to send the event
                  url = url + event.addParams(eventType, mergeTwoObjects(params,eventAlreadyFired[eventName]));
                  event.loadPixel(url);
              }
          }
      
          // Click tracker manager
          // url (r) : url of redirection, can be null = in that case the redirection is the one written in the dashboard
          // cssTag (r) : DOM object that triggers the click
          // params (o) : parameters as object
          // clickPixel (o) : array of string urls that are called server to server once the user click
          event.clickCustom = function eventClickCustom(url, cssElement, params, clickPixel){
              cssElement.addEventListener('click', function triggerRedirection(){
                  var redirect = event.buildUrl(url, clickPixel);
                  redirect += addParams("i", params);
                  aElement.href = redirect;
                  allowRedirect = true;
              },false);
          };
      
          event.clickDynCCFromDB = function eventClickDynCCFromDB(url, encodedBool, cssElement, params, clickPixel){
              var redirect = encodedBool ? encodeURIComponent(url): url;
              event.clickCustom(urlRedirectionDashboard + redirect, cssElement, params, clickPixel);
          }
          // Url of redirect builder
          // url (r) : url of redirection, can be null = in that case the redirection is the one written in the dashboard
          // params (o) : parameters as object
          // clickPixel (o) : array of string urls that are called server to server once the user click    
          event.buildUrl = function eventBuildUrl(url, clickPixel){
              var redirect = trackerClickUrl;
      
              if(url){
                  redirect = updateQueryStringParameter(redirect,"r",encodeURIComponent(url));
              }
              if(clickPixel){
                  for(var i = 0; i < clickPixel.length; i++){
                      redirect = updateQueryStringParameter(redirect, "call[" + (nbCallsInUrl + i ) + "]", encodeURIComponent(clickPixel));
                  }
              }
              return redirect;
          };
      
          // Simple click manager that redirect to the dashboard url
          // cssTag (r) : DOM object that triggers the click
          // params (o) : parameters as object
          // clickPixel (o) : string url that is called server to server once the user click
          event.click = event.clickCustom.bind(null, "");
      
          // Timer event manager : indicated the time spent on the creative
          // triggers 5 events
          // params (o) : list of interval as array
          event.setTimer = function eventSetTimer(interval){
              if(!interval){
                  interval = [3, 6, 9, 12, 20];
              }
              for(var i = 0; i < interval.length; i++){
                  (function(x){setTimeout(function(){
                      event.trigger("time-" + x + "s", 't');
                  },x * 1000)})(interval[i])
              }
          };
      
          // add constant param to all events and click
          event.setParam = mergeTwoObjects.bind(null, constant_params);
      
          // Merge two objects together
          // toObject (o) : Object of destination
          // fromObject (o) : Object to add to an other one   
          function mergeTwoObjects(toObject, fromObject){
              if(typeof fromObject === "object" || typeof toObject === "object"){
                  for(var  key in fromObject){
                      toObject[key] = fromObject[key];
                  }
              }
              return toObject;
          }
      
          // Parameters manager : create a querystring for the redirect url with all the parameters given and calculated
          // eventType (r) : type of event (i or t) to generate calculated parameters in accordance
          // oParams (r) : object of parameters key/value
          event.addParams =  function addParams(eventType, oParams){
              var params = '';
              var timeEvent = new Date();
      
              // create an object of parameter if not given
              if(!oParams){
                  oParams = {}
              }
      
              // store moment when the event happened
              oParams["t"] = ( timeEvent.getTime() - timeStart.getTime() ) / 1000;
              if(oParams["t"] > 3000){
                  oParams["t"] = 3000;
              }
              oParams["t"] = Math.round(oParams["t"]); 
      
              //store the event type
              oParams["et"] = eventType;
      
              // store the position of the interaction
              if(eventType == "i"){
                  oParams["p"] = pos_interact;
              }
      
              // combine the constant parameters and the custom parameters
              mergeTwoObjects(oParams, constant_params);
      
              // add all parameters as query string
              for(var name in oParams){
                  params += '&p_' + name + '=' + encodeURIComponent(oParams[name]);
              }
              return params;
          }
      
          // Update or create parameter in a given url with query string
          // uri (r) : string url
          // key (r) : name of the parameter in the querystring to be updated
          // value (r) : value of the parameter in the querystring to be updated
          function updateQueryStringParameter(uri, key, value){
              var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
              var separator = uri.indexOf('?') !== -1 ? "&" : "?";
      
              if(uri.match(re)){
                  return uri.replace(re, '$1' + key + "=" + value + '$2');
              }
              else{
                  return uri + separator + key + "=" + value;
              }
          }
      
          // Listen to every interaction on the creative and store the position of the interaction
          function captureInteraction(){
              document.documentElement.addEventListener('click', getPosition, true);
              document.documentElement.addEventListener('touchstart', getPosition, true);
              document.documentElement.addEventListener('mousedown', getPosition, true);
          }
      
          function getPosition(evt){
              var xPos = evt.clientX || evt.targetTouches[0].clientX;
              var yPos = evt.clientY || evt.targetTouches[0].clientY;
              if(!(isNaN(xPos) || isNaN(yPos))){
                  pos_interact = Math.round(xPos / screenX * 100) + "_" + Math.round(yPos / screenY * 100);
              }else{
                  pos_interact = "0_0";
              }
          }
          function handleRedirection(evt){
              if(allowRedirect && !alreadyClicked){
                  alreadyClicked = true;
                  allowRedirect = false;
                  // Case of google ssp
                  if(config.macro.gClick.indexOf("CLICK_URL_UNESC") === -1){
                      event.loadPixel(config.macro.gClick);
                  }
              } else {
                  evt.preventDefault();
              }
          }
      
          function getParameterByName(name, url) {
              name = name.replace(/[\[\]]/g, "\\$&");
              var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
                  results = regex.exec(url);
              if (!results) return null;
              if (!results[2]) return '';
              return decodeURIComponent(results[2].replace(/\+/g, " "));
          }
          // Initial function to be executed when the event handler is created
          function init(){
      
              // HANDLE REDIRECTION IN CASE OF DEMO
              if(trackerClickUrl.indexOf(">clickUrl}}") > -1){
                  trackerClickUrl = "https://tracker.adotmob.com/track/ADOTMOB_ID/CAMPAIGN_ID/click?b=BID&c=v2&idfa=IDFA&ex=a&offer=CAMPAIGN_ID&r=https%3A%2F%2Fadotmob.com&call[0]=top&call[1]=dsds&test=studio";
              }
      
              // BUILD TRACKER URL FOR EVENTS
              trackerEventUrl = trackerClickUrl;
              // delete the redirection in the events url
              trackerEventUrl = updateQueryStringParameter(trackerEventUrl, "r", "");
              trackerEventUrl = trackerEventUrl.replace('&r=',"");
              // delete the cookie offer in the events url
              trackerEventUrl = updateQueryStringParameter(trackerEventUrl, "offer", "");
              // delete all the pixel calls in the events url
              // count how many call url are present in the redirect url
              nbCallsInUrl = trackerEventUrl.split('call[').length - 1;
              if(nbCallsInUrl > 0){
                  for(var i = 0; i < nbCallsInUrl; i++){
                      trackerEventUrl = trackerEventUrl.replace("call[" + i + "]", "call"+i);
                      trackerEventUrl = updateQueryStringParameter(trackerEventUrl, "call" +i, "");
                  }
                  for(var i = 0; i < nbCallsInUrl; i++){
                  }
              }
          }
      
          function init_load(){
      
              // CAPTURE USER & DEVICE DATA
              captureInteraction();
              event.setParam({'w' : screenX, 'h' : screenY});
      
              // EVENT LISTENER ON CLICK
              aElement = document.querySelector('#adm-redirect');
              if(!aElement){ // case if there is no a node in the DOM
                  aElement = document.createElement('a');
                  aElement.target = '_blank';
                  aElement.href = trackerClickUrl;
                  aElement.style = "position:fixed;width:100vw;height:100vh;top:0;left:0";
                  document.querySelector('body').appendChild(aElement);
              }
              aElement.addEventListener('click', handleRedirection, false);
      
      
          }
          init();
          document.addEventListener('DOMContentLoaded',init_load);
      
          return event;
    }
  
    var events = createEvent(configAdm);
  
    events.trigger('loaded_imp','i');
  
    console.log('event imp')
    this.callEvent_('AdStarted');
    this.callEvent_('AdImpression');
  
    
  };
  
  
  /**
   * Called by the wrapper to stop the ad.
   */
  VpaidVideoPlayer.prototype.stopAd = function() {
    // this.log('Stopping ad');
    if (this.intervalId_){
      clearInterval(this.intervalId_)
    }
    // Calling AdStopped immediately terminates the ad. Setting a timeout allows
    // events to go through.
    var callback = this.callEvent_.bind(this);
    setTimeout(callback, 75, ['AdStopped']);
  };
  
  
  /**
   * @param {number} value The volume in percentage.
   */
  VpaidVideoPlayer.prototype.setAdVolume = function(value) {
    this.attributes_['volume'] = value;
    // this.log('setAdVolume ' + value);
    this.videoSlot_.volume = value / 100.0;
    this.callEvent_('AdVolumeChange');
  };
  
  
  /**
   * @return {number} The volume of the ad.
   */
  VpaidVideoPlayer.prototype.getAdVolume = function() {
    // this.log('getAdVolume');
    return this.attributes_['volume'];
  };
  
  
  /**
   * @param {number} width The new width.
   * @param {number} height A new height.
   * @param {string} viewMode A new view mode.
   */
  VpaidVideoPlayer.prototype.resizeAd = function(width, height, viewMode) {
    // this.log('resizeAd ' + width + 'x' + height + ' ' + viewMode);
    this.attributes_['width'] = width;
    this.attributes_['height'] = height;
    this.attributes_['viewMode'] = viewMode;
    this.updateVideoPlayerSize_();
    this.callEvent_('AdSizeChange');
  };
  
  
  /**
   * Pauses the ad.
   */
  VpaidVideoPlayer.prototype.pauseAd = function() {
    // this.log('pauseAd');
    this.videoSlot_.pause();
    this.callEvent_('AdPaused');
    if (this.intervalId_){
      clearInterval(this.intervalId_)
    }
  };
  
  
  /**
   * Resumes the ad.
   */
  VpaidVideoPlayer.prototype.resumeAd = function() {
    // this.log('resumeAd');
    this.videoSlot_.play();
    this.callEvent_('AdPlaying');
    var callback = (function(){
      this.attributes_['remainingTime'] -= 0.25;
      this.callEvent_('AdRemainingTimeChange');
    }).bind(this);
    this.intervalId_ = setInterval(callback, 250);
  };
  
  
  /**
   * Expands the ad.
   */
  VpaidVideoPlayer.prototype.expandAd = function() {
    // this.log('expandAd');
    this.attributes_['expanded'] = true;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
    this.callEvent_('AdExpanded');
  };
  
  
  /**
   * Returns true if the ad is expanded.
   * @return {boolean}
   */
  VpaidVideoPlayer.prototype.getAdExpanded = function() {
    // this.log('getAdExpanded');
    return this.attributes_['expanded'];
  };
  
  
  /**
   * Returns the skippable state of the ad.
   * @return {boolean}
   */
  VpaidVideoPlayer.prototype.getAdSkippableState = function() {
    // this.log('getAdSkippableState');
    return this.attributes_['skippableState'];
  };
  
  
  /**
   * Collapses the ad.
   */
  VpaidVideoPlayer.prototype.collapseAd = function() {
    // this.log('collapseAd');
    this.attributes_['expanded'] = false;
  };
  
  
  /**
   * Skips the ad.
   */
  VpaidVideoPlayer.prototype.skipAd = function() {
    // this.log('skipAd');
    var skippableState = this.attributes_['skippableState'];
    if (skippableState) {
      this.callEvent_('AdSkipped');
    }
  };
  
  
  /**
   * Registers a callback for an event.
   * @param {Function} aCallback The callback function.
   * @param {string} eventName The callback type.
   * @param {Object} aContext The context for the callback.
   */
  VpaidVideoPlayer.prototype.subscribe = function(
      aCallback,
      eventName,
      aContext) {
    // this.log('Subscribe ' + aCallback);
    var callBack = aCallback.bind(aContext);
    this.eventsCallbacks_[eventName] = callBack;
  };
  
  
  /**
   * Removes a callback based on the eventName.
   *
   * @param {string} eventName The callback type.
   */
  VpaidVideoPlayer.prototype.unsubscribe = function(eventName) {
    // this.log('unsubscribe ' + eventName);
    this.eventsCallbacks_[eventName] = null;
  };
  
  
  /**
   * @return {number} The ad width.
   */
  VpaidVideoPlayer.prototype.getAdWidth = function() {
    return this.attributes_['width'];
  };
  
  
  /**
   * @return {number} The ad height.
   */
  VpaidVideoPlayer.prototype.getAdHeight = function() {
    return this.attributes_['height'];
  };
  
  
  /**
   * @return {number} The time remaining in the ad.
   */
  VpaidVideoPlayer.prototype.getAdRemainingTime = function() {
    return this.attributes_['remainingTime'];
  };
  
  
  /**
   * @return {number} The duration of the ad.
   */
  VpaidVideoPlayer.prototype.getAdDuration = function() {
    return this.attributes_['duration'];
  };
  
  
  /**
   * @return {string} List of companions in vast xml.
   */
  VpaidVideoPlayer.prototype.getAdCompanions = function() {
    return this.attributes_['companions'];
  };
  
  
  /**
   * @return {boolean} A list of icons.
   */
  VpaidVideoPlayer.prototype.getAdIcons = function() {
    return this.attributes_['icons'];
  };
  
  
  /**
   * @return {boolean} True if the ad is a linear, false for non linear.
   */
  VpaidVideoPlayer.prototype.getAdLinear = function() {
    return this.attributes_['linear'];
  };
  
  
  /**
   * Logs events and messages.
   *
   * @param {string} message
   */
  VpaidVideoPlayer.prototype.log = function(message) {
    console.log(message);
  };
  
  
  /**
   * Calls an event if there is a callback.
   * @param {string} eventType
   * @private
   */
  VpaidVideoPlayer.prototype.callEvent_ = function(eventType) {
    if (eventType in this.eventsCallbacks_) {
      this.eventsCallbacks_[eventType]();
    }
  };
  
  
  /**
   * Callback for when the mute button is clicked.
   * @private
   */
  VpaidVideoPlayer.prototype.muteButtonOnClick_ = function() {
    if (this.attributes_['volume'] == 0) {
      this.attributes_['volume'] = 1.0;
      this.videoSlot_.volume = 1.0;
    } else {
      this.attributes_['volume'] = 0.0;
      this.videoSlot_.volume = 0.0;
    }
    this.callEvent_('AdVolumeChange');
  };
  
  
  /**
   * Callback when the video element calls start.
   * @private
   */
  VpaidVideoPlayer.prototype.videoResume_ = function() {
    // this.log("video element resumed.");
  };
  
  
  /**
   * Main function called by wrapper to get the VPAID ad.
   * @return {Object} The VPAID compliant ad.
   */
  var getVPAIDAd = function() {
    return new VpaidVideoPlayer();
  };
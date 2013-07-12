function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
};


function pointToLayer(feature, latlng) {
    return L.circleMarker(latlng, {
        radius: 8,
        opacity: 1,
        fillOpacity: 1               
    });
};


function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({ weight: 4, color: '#993'});

    if (!L.Browser.ie && !L.Browser.opera) {
        layer.bringToFront();
    };

    info.update(layer.feature.properties);
};


function resetHighlight(e) {
    e.target.feature.level.layer.resetStyle(e.target);
};


function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
};


function initializeLevel(levelId) {
    var level = levels[levelId];

    var style = level.geometry == 'area' ? styleArea : stylePoint;
    var args = {
        onEachFeature: function (feature, layer) {
            onEachFeature(feature, layer);
            feature.level = level;
        },
        style: style,
        pointToLayer: pointToLayer
    };

    level.layer = L.geoJson(level.data, args);
    level.layer.defaultStyle = style;
};


function styleBase() {
    var bcolor = [255, 255, 255];
    var fcolor;
    var range;
    if (currentStyle == 'participant') {
        fcolor = participants[currentStyleP].color;
        range = participantVoteStat[currentStyleP];
    } else if (currentStyle == 'turnout' || currentStyle == 'absentee') {
        fcolor = [0, 0, 0];
        range = parameterStat[currentStyle];
    } else {
        return undefined;
    };
    return {
        min: range.min,
        max: range.max,
        color: {
            min: fcolor,
            max: bcolor
        }
    };
};

function styleBlendP(base, p) {
    return [
        Math.round(base.color.min[0] * p + base.color.max[0] * (1 - p)),
        Math.round(base.color.min[1] * p + base.color.max[1] * (1 - p)),
        Math.round(base.color.min[2] * p + base.color.max[2] * (1 - p)),
    ];
};


function styleBlendValue (base, value) {
    var p = (value - base.min) / (base.max - base.min);
    if (p < 0) { p = 0; };
    if (p > 1) { p = 1; };
    return styleBlendP(base, p);
};


function colorToRgb(c) {
    return 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
};


function getColor(props) {
    var fcolor, p;
    var bcolor = [255, 255, 255];

    if (currentStyle == 'participant') {
        var s = participantVoteStat[currentStyleP];
        fcolor = participants[currentStyleP].color;
        p = (props.participant[currentStyleP][0] - s.min) / (s.max - s.min);
    } else if (currentStyle == 'turnout') {
        p = (props.turnout[0] - parameterStat.turnout.min) / (parameterStat.turnout.max - parameterStat.turnout.min);
        fcolor = [0, 0, 0];
    } else if (currentStyle == 'absentee') {
        p = (props.absentee[0] - parameterStat.absentee.min) / (parameterStat.absentee.max - parameterStat.absentee.min);
        fcolor = [0, 0, 0];
    } else if (currentStyle == 'place') {
        p = 1;
        fcolor = participants[props.participant_order[currentStyleP-1]].color;
        bcolor = fcolor;
    };

    return 'rgb('
        + Math.round(fcolor[0]*p + bcolor[0]*(1-p)) + ', '
        + Math.round(fcolor[1]*p + bcolor[1]*(1-p)) + ', '
        + Math.round(fcolor[2]*p + bcolor[2]*(1-p))
        + ')';
};


function styleArea(feature) {
    return {
        fillColor: getColor(feature.properties),
        weight: 0.5,
        opacity: 1,
        color: '#666',
        fillOpacity: 0.5
    };
};

function stylePoint(feature) {
    return {
        fillColor: getColor(feature.properties),
        weight: 1,
        opacity: 1,
        color: '#666',
        fillOpacity: 1
    };
};


function setStyle(newStyle, styleParam) {
    currentStyle = newStyle;
    currentStyleP = styleParam;

    currentStyleBase = styleBase();
    L.DomUtil.get('style-color').innerHTML = '';
    L.DomUtil.get('style-value').innerHTML = '';

    if (currentStyleBase) {
        for (var p = 1.0; p >= 0; p = p - 0.25) {
            L.DomUtil.get('style-color').innerHTML = L.DomUtil.get('style-color').innerHTML + 
                '<td style="width: 25%; background-color: ' + colorToRgb(styleBlendP(currentStyleBase, p / 2)) + '; width: 16px;">&nbsp;</td>';
            L.DomUtil.get('style-value').innerHTML = L.DomUtil.get('style-value').innerHTML +
                '<td>' + (currentStyleBase.min + (currentStyleBase.max - currentStyleBase.min) * p).toFixed(2) + '%</td>';
        };
    };
    
    var styleTitle;
    if (currentStyle == 'participant') {
        styleTitle = participants[currentStyleP].name;
    } else if (currentStyle == 'turnout') {
        styleTitle = "Явка";
    } else if (currentStyle == 'absentee') {
        styleTitle = "Открепительные";
    } else if (currentStyle == 'place') {
        styleTitle = "Итоговое " + currentStyleP + "-е место";
    };
    L.DomUtil.get('style-title').innerHTML = styleTitle;

    for (i in levels) {
        levels[i].layer.setStyle(levels[i].layer.defaultStyle);
    };
}
        
function switchLevel(level) {
    if (level == currentLevel) { return; };

    if (currentLevel != undefined) {
        map.removeLayer(currentLevel.layer);
    };

    currentLevel = level;
    currentLevel.layer.addTo(map);
};

function zoomEnd(e) {
    var newLevel;
    for (i in levels) {
        if (levels[i].zoom == null || levels[i].zoom <= map.getZoom()) {
            newLevel = levels[i];
        };
    };

    switchLevel(newLevel);
};




var map = L.map('map').setView([55.755786, 37.617633], 10);
map.on('zoomend', zoomEnd);


var info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.get('info'); // create a div with a class "info"
    return this._div;
};

info.update = function (props) {
    L.DomUtil.get('result-head').innerHTML = props.name;
    for (p in props.participant) {
        L.DomUtil.get('p-' + p + '-p').innerHTML = props.participant[p][0].toFixed(2);
        L.DomUtil.get('p-' + p + '-c').innerHTML = props.participant[p][1];
    };
    L.DomUtil.get('turnout-p').innerHTML = props.turnout[0].toFixed(2);
    L.DomUtil.get('turnout-c').innerHTML = props.turnout[1];
    L.DomUtil.get('absentee-p').innerHTML = props.absentee[0].toFixed(2);
    L.DomUtil.get('absentee-c').innerHTML = props.absentee[1];
};

info.addTo(map);


var legend = L.control();

legend.onAdd = function (map) {
    this._div = L.DomUtil.get('legend'); // create a div with a class "info"
    return this._div;
};

legend.addTo(map);

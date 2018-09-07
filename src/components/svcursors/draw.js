/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var d3 = require('d3');

var Registry = require('../../registry');
var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');
var Color = require('../color');
var Drawing = require('../drawing');
var svgTextUtils = require('../../lib/svg_text_utils');

var dragElement = require('../dragelement');
var setCursor = require('../../lib/setcursor');

// var constants = require('../shapes/constants');
var shapeHelpers = require('../shapes/helpers');

var Fx = require('../fx');
var FxHover = require('../fx/hover');
var FxConstants = require('../fx/constants');
var FxHelpers = require('../fx/helpers');

// size and display constants for hover text
var HOVERARROWSIZE = FxConstants.HOVERARROWSIZE;
var HOVERTEXTPAD = FxConstants.HOVERTEXTPAD;

var loggersModule = require('../../lib/loggers');

var isNumeric = require('fast-isnumeric');
var getTraceColor = require('../../traces/scatter/get_trace_color');

var CURSOR_GROUP_CLASS = 'svcursor_group';
var CURSOR_AXIS_LABEL_CLASS = 'svcursor_axis_label';
var CURSOR_FLAG_CLASS = 'svcursor_flag';

var supportedAxisTypes = ['linear', 'date', 'log'];

// svcursors are stored in gd.layout.svcursors, an array of objects
// index can point to one item in this array,
//  or non-numeric to simply add a new one
//  or -1 to modify all existing
// opt can be the full options object, or one key (to be set to value)
//  or undefined to simply redraw
// if opt is blank, val can be 'add' or a full options object to add a new
//  svcursor at that point in the array, or 'remove' to delete this one

module.exports = {
    draw: draw,
    drawOne: drawOne,
    updateFlags: updateFlags
};

function draw(gd) {
    var fullLayout = gd._fullLayout;

    // Remove previous svcursors before drawing new in svcursors in fullLayout.svcursors

    var sel = gd._fullLayout._paperdiv.selectAll('.' + CURSOR_GROUP_CLASS);
    if(sel.size() !== fullLayout.svcursors.length) {
        sel.remove();
    }

    for(var i = 0; i < fullLayout.svcursors.length; i++) {
        drawOne(gd, i);
    }
}

function isInRange(x, cursorXAxis) {
    var dd = {};
    dd.x = x;
    return cursorXAxis.isPtWithinRange(dd, cursorXAxis.calendar);
}

function updateFlags(gd, index, yValues) {

    var svcursorOptions = gd._fullLayout.svcursors[index];

    var selector = '#cursorGroup_' + index;
    var cursorGroup = d3.select(selector);
    createLabels(gd, svcursorOptions, cursorGroup, yValues);
}

function getXValueAsNumber(xVal, cursorXAxis) {
    var xxx = xVal;
    var convert = false;

    if(!isNumeric(xVal) && cursorXAxis.type === 'date') {
        var calendar = cursorXAxis.calendar;
        xxx = cursorXAxis.d2c(xVal, 0, calendar);
        convert = true;
    }

    var result = {
        xVal: xxx,
        convert: convert
    };

    return result;
}

function fixXValue(x, cursorXAxis) {

    var xMin;
    var xMax;
    var xval = x;

    var convert = false;

    var result = getXValueAsNumber(x, cursorXAxis);

    xval = result.xVal;
    convert = result.convert;

    if(isInRange(xval, cursorXAxis)) {
        if(convert) {
            xval = cursorXAxis.c2d(xval);
        }
        return xval;
    }

    if(cursorXAxis._rl) {
        xMin = cursorXAxis._rl[0];
        xMax = cursorXAxis._rl[1];
    } else {
        xMin = cursorXAxis.range[0];
        xMax = cursorXAxis.range[1];
    }

    if(xval < xMin) {
        xval = xMin;
    }

    if(xval > xMax) {
        xval = xMax;
    }

    if(convert) {
        xval = cursorXAxis.c2d(xval);
    }
    return xval;
}

function drawOne(gd, index) {
    // remove the existing svcursor if there is one.
    // because indices can change, we need to look in all svcursor layers
    gd._fullLayout._paperdiv
        .selectAll('.svcursorlayer [data-index="' + index + '"]')
        .remove();

    var optionsIn = (gd.layout.svcursors || [])[index],
        svcursorOptions = gd._fullLayout.svcursors[index];

    // this svcursor is gone - quit now after deleting it
    // TODO: use d3 idioms instead of deleting and redrawing every time
    if(!optionsIn) return;

    var hasCartesian = gd._fullLayout._has('cartesian');

    if(!hasCartesian) {
        return;
    }

    // if(svcursorOptions.layer !== 'below') {
    //     drawSvcursor(gd._fullLayout._svcursorUpperLayer, index);
    // }
    // else {
    //     var plotinfo = gd._fullLayout._plots[svcursorOptions.xref + svcursorOptions.yref];
    //     if(plotinfo) {
    //         var mainPlot = plotinfo.mainplotinfo || plotinfo;
    //         drawSvcursor(mainPlot.svcursorlayer, index);
    //     }
    //     else {
    //         // Fall back to _svcursorUpperLayer in case the requested subplot doesn't exist.
    //         // This can happen if you reference the svcursor to an x / y axis combination
    //         // that doesn't have any data on it
    //         drawSvcursor(gd._fullLayout._svcursorUpperLayer, index);
    //     }
    // }

    drawSvcursor(index);

    function isAxisSupported(axisType) {

        for(var i = 0; i < supportedAxisTypes.length; i++) {
            if(supportedAxisTypes[i] === axisType) {
                return true;
            }
        }
        return false;
    }

    function drawSvcursor(index) {

        var svcursorLayer = gd._fullLayout._svcursorUpperLayer;

        var cursorXAxis = Axes.getFromId(gd, svcursorOptions.xref);
        var axisType = cursorXAxis.type;


        if(!isAxisSupported(axisType)) {
            loggersModule.warn('Cursors are not supported for such type of X data');
            return;
        }

        var id = 'cursorGroup_' + index;
        var attrs = {
            'data-index': index,
            'fill-rule': 'evenodd',
            d: getPathString(gd, svcursorOptions)
        };

        var cursorGroup = Lib.ensureSingleById(svcursorLayer, 'g', id);
        cursorGroup.classed(CURSOR_GROUP_CLASS, true);

        var lineColor = svcursorOptions.line.width ? svcursorOptions.line.color : 'rgba(0,0,0,0)';
        var path = cursorGroup.append('path')
            .attr(attrs)
            .style('opacity', svcursorOptions.opacity)
            .call(Color.stroke, lineColor)
            .call(Color.fill, svcursorOptions.fillcolor)
            .call(Drawing.dashLine, svcursorOptions.line.dash, svcursorOptions.line.width);
        // SystemVision: To support context menu
        // .on("contextmenu", function (d, i) {
        //     d3.event.preventDefault();
        //     if(d3.event.button === 2) {
        //       console.log('right click')
        //     } else {
        //       console.log('left click')
        //     }
        //   });

        createLabels(gd, svcursorOptions, cursorGroup, null);

        // SystemVision: Always support dragging
        setupDragElement(gd, path, svcursorOptions, index, cursorGroup);
    }
}

function cleanPoint(d) {
    var index = d.index;
    var trace = d.trace || {};
    var cd0 = d.cd[0];
    var cd = d.cd[index] || {};

    var getVal = Array.isArray(index) ?
        function(calcKey, traceKey) {
            return Lib.castOption(cd0, index, calcKey) ||
                Lib.extractOption({}, trace, '', traceKey);
        } :
        function(calcKey, traceKey) {
            return Lib.extractOption(cd, trace, calcKey, traceKey);
        };

    function fill(key, calcKey, traceKey) {
        var val = getVal(calcKey, traceKey);
        if(val) d[key] = val;
    }

    fill('hoverinfo', 'hi', 'hoverinfo');
    fill('color', 'hbg', 'hoverlabel.bgcolor');
    fill('borderColor', 'hbc', 'hoverlabel.bordercolor');
    fill('fontFamily', 'htf', 'hoverlabel.font.family');
    fill('fontSize', 'hts', 'hoverlabel.font.size');
    fill('fontColor', 'htc', 'hoverlabel.font.color');
    fill('nameLength', 'hnl', 'hoverlabel.namelength');

    d.posref = d.ya._offset + (d.y0 + d.y1) / 2;

    // then constrain all the positions to be on the plot
    d.x0 = Lib.constrain(d.x0, 0, d.xa._length);
    d.x1 = Lib.constrain(d.x1, 0, d.xa._length);
    d.y0 = Lib.constrain(d.y0, 0, d.ya._length);
    d.y1 = Lib.constrain(d.y1, 0, d.ya._length);

    // and convert the x and y label values into formatted text
    if(d.xLabelVal !== undefined) {
        d.xLabel = ('xLabel' in d) ? d.xLabel : Axes.hoverLabelText(d.xa, d.xLabelVal);
        d.xVal = d.xa.c2d(d.xLabelVal);
    }
    if(d.yLabelVal !== undefined) {
        d.yLabel = ('yLabel' in d) ? d.yLabel : Axes.hoverLabelText(d.ya, d.yLabelVal);
        d.yVal = d.ya.c2d(d.yLabelVal);
    }

    return d;
}


function setupDragElement(gd, svcursorPath, svcursorOptions, index, cursorGroup) {
    var MINWIDTH = 10,
        MINHEIGHT = 10;

    var update;
    var x0, astrX0;

    var xa = Axes.getFromId(gd, svcursorOptions.xref);

    var convFunc = getConvertFunction(gd, svcursorOptions);

    var dragOptions = {
            element: svcursorPath.node(),
            gd: gd,
            prepFn: startDrag,
            doneFn: endDrag,
            curX: svcursorOptions.x
        },
        dragBBox = dragOptions.element.getBoundingClientRect();

    dragElement.init(dragOptions);

    svcursorPath.node().onmousemove = updateDragMode;

    function updateDragMode(evt) {
        // choose 'move' or 'resize'
        // based on initial position of cursor within the drag element
        var w = dragBBox.right - dragBBox.left,
            h = dragBBox.bottom - dragBBox.top,
            x = evt.clientX - dragBBox.left,
            y = evt.clientY - dragBBox.top,
            cursor = (w > MINWIDTH && h > MINHEIGHT && !evt.shiftKey) ?
                dragElement.getCursor(x / w, 1 - y / h) :
                'move';

        setCursor(svcursorPath, cursor);
    }

    function startDrag(evt) {
        svcursorOptions.x = fixXValue(svcursorOptions.x, xa);

        x0 = convFunc.x2p(svcursorOptions.x);
        astrX0 = 'svcursors[' + index + ']' + '.x';

        update = {};

        // setup dragMode and the corresponding handler
        updateDragMode(evt);
        dragOptions.moveFn = movesvcursor;
    }

    function endDrag() {
        if(svcursorOptions.cursorMode === 'frozen') {
            return;
        }
        setCursor(svcursorPath);

        Registry.call('relayout', gd, update).then(function() {
            var eventData = {
                index: index,
                svcursor: svcursorOptions._input,
                fullSVCursor: svcursorOptions,
                event: d3.event
            };

            // if(subplotId) {
            //     eventData.subplotId = subplotId;
            // }

            gd.emit('plotly_stopcursordrag', eventData);
            // var fixYValues = [];
            // fixYValues.singleTrace = '234';
            // fixYValues.secondTrace = 'QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ';
            // updateFlags(gd, index, fixYValues);
        });
    }

    function movesvcursor(dx) {
        if(svcursorOptions.cursorMode === 'frozen') {
            return;
        }

        if(svcursorOptions.type === 'line') {

            var newX = convFunc.p2x(x0 + dx);
            newX = fixXValue(newX, xa);

            if(newX !== null && newX !== undefined) {
                update[astrX0] = svcursorOptions.x = newX;
            }
        }

        svcursorPath.attr('d', getPathString(gd, svcursorOptions));

        createLabels(gd, svcursorOptions, cursorGroup, null);
    }
}

function getConvertFunction(gd, svcursorOptions) {

    var xa = Axes.getFromId(gd, svcursorOptions.xref),
        ya = Axes.getFromId(gd, svcursorOptions.yref);
    var x2r, x2p, y2r, y2p;
    var p2x, p2y;


    if(xa) {
        x2r = shapeHelpers.shapePositionToRange(xa);
        x2p = function(v) { return xa._offset + xa.r2p(x2r(v, true)); };

        p2x = shapeHelpers.getPixelToData(gd, xa);
    }

    if(ya) {
        y2r = shapeHelpers.shapePositionToRange(ya);
        y2p = function(v) { return ya._offset + ya.r2p(y2r(v, true)); };

        p2y = shapeHelpers.getPixelToData(gd, ya);
    }

    if(xa && xa.type === 'date') {
        x2p = shapeHelpers.decodeDate(x2p);
    }
    if(ya && ya.type === 'date') {
        y2p = shapeHelpers.decodeDate(y2p);
    }
    var convFunc = {
        x2p: x2p,
        y2p: y2p,
        p2x: p2x,
        p2y: p2y
    };

    return convFunc;
}

function getPathString(gd, svcursorOptions) {

    var xa = Axes.getFromId(gd, svcursorOptions.xref);

    var convFunc = getConvertFunction(gd, svcursorOptions);

    var x0, x1;
    x0 = x1 = convFunc.x2p(svcursorOptions.x);

    var y0 = xa._counterSpan[0];
    var y1 = xa._counterSpan[1];

    return 'M' + x0 + ',' + y0 + 'L' + x1 + ',' + y1;

}

function createLabelText(hoverData, opts, gd, svcursorOptions, cursorGroup) {
    var bgColor = opts.bgColor;
    var container = cursorGroup;// opts.container;
    var outerContainer = opts.outerContainer;
    var commonLabelOpts = opts.commonLabelOpts || {};
    var showCommonLabel = true;

    // opts.fontFamily/Size are used for the common label
    // and as defaults for each hover label, though the individual labels
    // can override this.
    var fontFamily = opts.fontFamily || FxConstants.HOVERFONT;
    var fontSize = opts.fontSize || FxConstants.HOVERFONTSIZE;

    var xa = Axes.getFromId(gd, svcursorOptions.xref);
    var ya = Axes.getFromId(gd, svcursorOptions.yref);

    var convFunc = getConvertFunction(gd, svcursorOptions);

    var x0 = convFunc.x2p(svcursorOptions.x);

    var result = getXValueAsNumber(svcursorOptions.x, xa);
    var xLabelValue = result.xVal;

    var xAxisLabelText = Axes.hoverLabelText(xa, xLabelValue);

    var outerContainerBB = outerContainer.node().getBoundingClientRect();
    var outerTop = outerContainerBB.top;
    var outerWidth = outerContainerBB.width;

    var commonLabel = cursorGroup.selectAll('g.' + CURSOR_AXIS_LABEL_CLASS)
        .data(showCommonLabel ? [0] : []);
    commonLabel.enter().append('g')
        .classed(CURSOR_AXIS_LABEL_CLASS, true);
    commonLabel.exit().remove();

    commonLabel.each(function() {
        var label = d3.select(this);
        var lpath = Lib.ensureSingle(label, 'path', null, function(s) {
            s.style({ 'stroke-width': '1px' });
        });

        var ltext = Lib.ensureSingle(label, 'text', null, null);


        lpath.style({
            fill: commonLabelOpts.bgcolor || Color.defaultLine,
            stroke: commonLabelOpts.bordercolor || Color.background,
        });


        ltext.text(xAxisLabelText)
            .attr('label-value', xLabelValue)
            .attr('label-date', svcursorOptions.x)
            .call(Drawing.font,
                commonLabelOpts.font.family || fontFamily,
                commonLabelOpts.font.size || fontSize,
                commonLabelOpts.font.color || Color.background
            )
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        label.attr('transform', '');

        var tbb = ltext.node().getBoundingClientRect();

        var topsign = xa.side === 'top' ? '-' : '';
        lpath.attr('d', 'M0,0' +
                'L' + HOVERARROWSIZE + ',' + topsign + HOVERARROWSIZE +
                'H' + (HOVERTEXTPAD + tbb.width / 2) +
                'v' + topsign + (HOVERTEXTPAD * 2 + tbb.height) +
                'H-' + (HOVERTEXTPAD + tbb.width / 2) +
                'V' + topsign + HOVERARROWSIZE + 'H-' + HOVERARROWSIZE + 'Z');

        ltext.attr('text-anchor', 'middle')
                .call(svgTextUtils.positionText, 0, (xa.side === 'top' ?
                    (outerTop - tbb.bottom - HOVERARROWSIZE - HOVERTEXTPAD) :
                    (outerTop - tbb.top + HOVERARROWSIZE + HOVERTEXTPAD)));
        label.attr('transform', 'translate(' +
                (x0) + ',' +
                (ya._offset + (xa.side === 'top' ? 0 : ya._length)) + ')');
    });

    // show all the individual labels

    // first create the objects
    var hoverLabels = container.selectAll('g.' + CURSOR_FLAG_CLASS)
        .data(hoverData, function(d) {
            return [d.trace.index, d.index, d.x0, d.y0, d.name, d.attr, d.xa, d.ya || ''].join(',');
        });
    hoverLabels.enter().append('g')
        .classed(CURSOR_FLAG_CLASS, true)
        .each(function() {
            var g = d3.select(this);
            // trace name label (rect and text.name)
            g.append('rect')
                .call(Color.fill, Color.addOpacity(bgColor, 0.8));
            g.append('text').classed('name', true);
            // trace data label (path and text.nums)
            g.append('path')
                .style('stroke-width', '1px');
            g.append('text').classed('nums', true)
                .call(Drawing.font, fontFamily, fontSize);
        });
    hoverLabels.exit().remove();

    // then put the text in, position the pointer to the data,
    // and figure out sizes
    hoverLabels.each(function(d) {
        var g = d3.select(this).attr('transform', ''),
            text = '';

        // combine possible non-opaque trace color with bgColor
        var baseColor = Color.opacity(d.color) ? d.color : Color.defaultLine;
        var traceColor = Color.combine(baseColor, bgColor);

        // find a contrasting color for border and text
        var contrastColor = d.borderColor || Color.contrast(traceColor);

        text = d.yLabel;
        // if 'text' is empty at this point, remove the label
        if(text === '') {
            g.remove();
        }

        // main label
        var tx = g.select('text.nums')
            .call(Drawing.font,
                d.fontFamily || fontFamily,
                d.fontSize || fontSize,
                d.fontColor || contrastColor)
            .text(text)
            .attr('data-notex', 1)
            .attr('label-value', d.yLabelVal)
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        g.select('path')
            .style({
                fill: traceColor,
                stroke: contrastColor
            });
        var tbb = tx.node().getBoundingClientRect(),
            htx = d.xa._offset + (d.x0 + d.x1) / 2,
            hty = d.ya._offset + (d.y0 + d.y1) / 2,
            dx = Math.abs(d.x1 - d.x0),
            txTotalWidth = tbb.width + HOVERARROWSIZE + HOVERTEXTPAD,
            anchorStartOK,
            anchorEndOK;

        d.ty0 = outerTop - tbb.top;
        d.bx = tbb.width + 2 * HOVERTEXTPAD;
        d.by = tbb.height + 2 * HOVERTEXTPAD;
        d.anchor = 'start';
        d.txwidth = tbb.width;
        d.offset = 0;

        d.pos = hty;
        anchorStartOK = htx + dx / 2 + txTotalWidth <= outerWidth;
        anchorEndOK = htx - dx / 2 - txTotalWidth >= 0;
        if((d.idealAlign === 'left' || !anchorStartOK) && anchorEndOK) {
            htx -= dx / 2;
            d.anchor = 'end';
        } else if(anchorStartOK) {
            htx += dx / 2;
            d.anchor = 'start';
        } else d.anchor = 'middle';


        tx.attr('text-anchor', d.anchor);
        g.attr('transform', 'translate(' + htx + ',' + hty + ')');
    });

    var fullLayout = gd._fullLayout;

    FxHover.avoidOverlaps(hoverData, 'ya', fullLayout);
    FxHover.alignHoverLabels(hoverLabels, false);
    return hoverLabels;
}

function createLabels(gd, svcursorOptions, cursorGroup, fixYValues) {

    var fullLayout = gd._fullLayout;
    var labelOpts = {
        hovermode: 'x',
        bgColor: Color.background || 'black',
        container: gd._fullLayout._svcursorUpperLayer,
        outerContainer: fullLayout._paperdiv,
        commonLabelOpts: fullLayout.hoverlabel,
        hoverdistance: fullLayout.hoverdistance
    };

    var subplots = gd._fullLayout._subplots.cartesian;
    var hoverData = initCursorData(gd, subplots, svcursorOptions, fixYValues);
    createLabelText(hoverData, labelOpts, gd, svcursorOptions, cursorGroup);
}


function initCursorData(gd, subplot, svcursorOptions, fixYValues) {
    if(!subplot) subplot = 'xy';

    // if the user passed in an array of subplots,
    // use those instead of finding overlayed plots
    var subplots = Array.isArray(subplot) ? subplot : [subplot];

    var fullLayout = gd._fullLayout;
    var plots = fullLayout._plots || [];
    var plotinfo = plots[subplot];
    // var hasCartesian = fullLayout._has('cartesian');

    // list of all overlaid subplots to look at
    if(plotinfo) {
        var overlayedSubplots = plotinfo.overlays.map(function(pi) {
            return pi.id;
        });

        subplots = subplots.concat(overlayedSubplots);
    }

    var len = subplots.length;
    var cursorXAxis = Axes.getFromId(gd, svcursorOptions.xref);

    var yaArray = new Array(len);

    for(var i = 0; i < len; i++) {
        var spId = subplots[i];

        // 'cartesian' case
        var plotObj = plots[spId];
        if(plotObj) {

            // TODO make sure that fullLayout_plots axis refs
            // get updated properly so that we don't have
            // to use Axes.getFromId in general.

            yaArray[i] = Axes.getFromId(gd, plotObj.yaxis._id);
            continue;
        }

        // other subplot types
        var _subplot = fullLayout[spId]._subplot;
        yaArray[i] = _subplot.yaxis;
    }

    // /////////////////////

    // var hoverdistance = fullLayout.hoverdistance === -1 ? Infinity : fullLayout.hoverdistance;
    // var spikedistance = fullLayout.spikedistance === -1 ? Infinity : fullLayout.spikedistance;
    // the pixel distance to beat as a matching point
    // in 'x' or 'y' mode this resets for each trace
    var distance = 10000;

    var hoverData = [],

        curvenum,
        cd,
        trace,
        subplotId,
        subploti,
        pointData;


    for(curvenum = 0; curvenum < gd.calcdata.length; curvenum++) {
        cd = gd.calcdata[curvenum];
        trace = cd[0].trace;
        if(subplots.indexOf(FxHelpers.getSubplot(trace)) === -1) {
            continue;
        }

        // filter out broken data
        if(!cd || !cd[0] || !trace) continue;


        subplotId = FxHelpers.getSubplot(trace);
        subploti = subplots.indexOf(subplotId);

        // container for new point, also used to pass info into module.hoverPoints
        pointData = {
            // trace properties
            cd: cd,
            trace: trace,
            xa: cursorXAxis,
            ya: yaArray[subploti],

            // point properties - override all of these
            index: false, // point index in trace - only used by plotly.js hoverdata consumers
            distance: distance,

            // where and how to display the hover label
            color: Color.defaultLine, // trace color
            name: trace.name,
            x0: undefined,
            x1: undefined,
            y0: undefined,
            y1: undefined,
            xLabelVal: undefined,
            yLabelVal: undefined,
            text: undefined
        };

        // SystemVision: If we use "date" in X axis, let be sure that we use x (as a time) in ms
        // So transfrom it from "2013-11-10 22:23:00" into 1384122180000, for example

        var result = getXValueAsNumber(svcursorOptions.x, cursorXAxis);
        var xValue = result.xVal;

        // SystemVision: We do not use yval to find hoverPoints, so it can be set to arbitrary value
        var yValue = 0;

        // Now if there is range to look in, find the points to hover.
        var fixYValue = null;
        if(fixYValues !== null && fixYValues !== undefined) {
            fixYValue = fixYValues[trace.name];
        }

        var newPoints = hoverPoints(pointData, xValue, yValue, fixYValue);
        if(newPoints) {
            var newPoint;
            for(var newPointNum = 0; newPointNum < newPoints.length; newPointNum++) {
                newPoint = newPoints[newPointNum];
                if(isNumeric(newPoint.x0) && isNumeric(newPoint.y0)) {
                    hoverData.push(cleanPoint(newPoint, 'x'));
                }
            }
        }
    }

    function hoverPoints(pointData, xval, yval, fixYValue) {
        var cd = pointData.cd;
        var trace = cd[0].trace;
        var traceXAxis = pointData.xa;
        var traceYAxis = pointData.ya;

        var xpx = traceXAxis.c2p(xval);
        // var ypx = traceYAxis.c2p(yval);
        // var minRad = (trace.mode.indexOf('markers') !== -1) ? 3 : 0.5;

        // find closest point by x
        var distfn = function(di) {
            // dx and dy are used in compare modes - here we want to always
            // prioritize the closest data point, at least as long as markers are
            // the same size or nonexistent, but still try to prioritize small markers too.
            var rad = Math.max(3, di.mrc || 0);
            var kink = 1 - 1 / rad;
            var dxRaw = Math.abs(traceXAxis.c2p(di.x) - xpx);
            var d = (dxRaw < rad) ? (kink * dxRaw / rad) : (dxRaw - rad + kink);
            return d;
        };

        var x0, y0, x1, y1, xx, yy;

        function getIntersectionPoint() {
            var lineShape = trace.line.shape;

            if(xx === x0) {
                return y0;
            }

            if(xx === x1) {
                return y1;
            }

            if(lineShape === 'hv') {
                if(xx < x1) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(lineShape === 'vh') {
                if(xx > x0) {
                    return y1;
                } else {
                    return y0;
                }
            }

            if(lineShape === 'hvh') {
                if(xx < (x0 + x1) / 2) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(lineShape === 'vhv') {
                if(xx > x0) {
                    return (y0 + y1) / 2;
                } else {
                    return y0;
                }
            }

            if(lineShape === 'linear') {
                return (xx - x0) * (y1 - y0) / (x1 - x0) + y0;
            }

            return null;
        }

        Fx.getClosest(cd, distfn, pointData);

        if(pointData.index !== false) { // skip the rest (for this trace) if we didn't find a close point

            // the closest data point
            var di = cd[pointData.index];

            var intersect = false;
            var exact = false;

            x0 = di.x;
            y0 = di.y;
            x1 = di.x;
            y1 = di.y;
            xx = traceXAxis.p2c(xpx);
            if(!isInRange(xx, traceXAxis)) {
                yy = null;
            } else {
                yy = di.y;

                var leftPoint = pointData.index;
                var rightPoint = pointData.index;
                if(pointData.distance < 0.0001) {
                    intersect = true;
                    exact = true;
                } else if(di.x > xx && pointData.index > 0) {
                    leftPoint = pointData.index - 1;
                    rightPoint = pointData.index;
                    intersect = true;
                } else if(di.x < xx && pointData.index < cd.length - 1) {
                    rightPoint = pointData.index + 1;
                    leftPoint = pointData.index;
                    intersect = true;
                }

                var dLeft = cd[leftPoint];
                x0 = dLeft.x;
                y0 = dLeft.y;
                var dRight = cd[rightPoint];
                x1 = dRight.x;
                y1 = dRight.y;


                if(intersect) {
                    if(exact) {
                        yy = y0;
                    } else {
                        yy = getIntersectionPoint();
                    }

                } else {
                    yy = null;
                }

                var xc = xpx;
                var yc = traceYAxis.c2p(yy);

                Lib.extendFlat(pointData, {
                    color: getTraceColor(trace, di),

                    x0: xc,
                    x1: xc,
                    xLabelVal: xx,

                    y0: yc,
                    y1: yc,
                    yLabelVal: yy
                });

                if(fixYValue !== null && fixYValue !== undefined) {
                    Lib.extendFlat(pointData, {
                        yLabel: fixYValue
                    });
                }

            }

            return [pointData];
        }
    }
    return hoverData;
}

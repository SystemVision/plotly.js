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

var constants = require('../shapes/constants');
var helpersShape = require('../shapes/helpers');

var Fx = require('../../components/fx');


var constantsFx = require('../fx/constants');

// size and display constants for hover text
var HOVERARROWSIZE = constantsFx.HOVERARROWSIZE;
var HOVERTEXTPAD = constantsFx.HOVERTEXTPAD;

var fx_helpers = require('../fx/helpers');
var isNumeric = require('fast-isnumeric');
var getTraceColor = require('../../traces/scatter/get_trace_color');

var CURSOR_GROUP_CLASS = 'svcursor_group';
var CURSOR_AXIS_LABEL_CLASS = 'svcursor_axis_label';
var CURSOR_FLAG_CLASS = 'svcursor_flag';

var YANGLE = constants.YANGLE;
var YA_RADIANS = Math.PI * YANGLE / 180;

// expansion of projected height
var YFACTOR = 1 / Math.sin(YA_RADIANS);

// svcursors are stored in gd.layout.svcursors, an array of objects
// index can point to one item in this array,
//  or non-numeric to simply add a new one
//  or -1 to modify all existing
// opt can be the full options object, or one key (to be set to value)
//  or undefined to simply redraw
// if opt is blank, val can be 'add' or a full options object to add a new
//  annotation at that point in the array, or 'remove' to delete this one

module.exports = {
    draw: draw,
    drawOne: drawOne
};

function draw(gd) {
    var fullLayout = gd._fullLayout;

    // Remove previous svcursors before drawing new in svcursors in fullLayout.svcursors
    // fullLayout._svcursorUpperLayer.selectAll('path').remove();
    // fullLayout._svcursorLowerLayer.selectAll('path').remove();
    // fullLayout._svcursorSubplotLayers.selectAll('path').remove();
    // fullLayout._svcursorUpperLayer.selectAll('text').remove();
    // fullLayout._svcursorLowerLayer.selectAll('text').remove();
    // fullLayout._svcursorSubplotLayers.selectAll('text').remove();

    var sel = gd._fullLayout._paperdiv.selectAll('.' + CURSOR_GROUP_CLASS);
    if(sel.size() !== fullLayout.svcursors.length) {
        sel.remove();
    }

    for(var i = 0; i < fullLayout.svcursors.length; i++) {
        drawOne(gd, i);
    }

    // may need to resurrect this if we put text (LaTeX) in svcursors
    // return Plots.previousPromises(gd);
}

function fixXValue(x, ax) {

    var xMin = ax.r2l(ax.range[0]);
    var xMax = ax.r2l(ax.range[1]);

    if(x < xMin) {
        return xMin;
    }

    if(x > xMax) {
        return xMax;
    }
    return x;
}

function drawOne(gd, index) {
    // remove the existing svcursor if there is one.
    // because indices can change, we need to look in all svcursor layers
    gd._fullLayout._paperdiv
        .selectAll('.svcursorlayer [data-index="' + index + '"]')
        .remove();

    var optionsIn = (gd.layout.svcursors || [])[index],
        options = gd._fullLayout.svcursors[index];

    // this svcursor is gone - quit now after deleting it
    // TODO: use d3 idioms instead of deleting and redrawing every time
    if(!optionsIn) return;

    if(options.layer !== 'below') {
        drawSvcursor(gd._fullLayout._svcursorUpperLayer, index);
    }
    else if(options.xref === 'paper' || options.yref === 'paper') {
        drawSvcursor(gd._fullLayout._svcursorLowerLayer, index);
    }
    else {
        var plotinfo = gd._fullLayout._plots[options.xref + options.yref];
        if(plotinfo) {
            var mainPlot = plotinfo.mainplotinfo || plotinfo;
            drawSvcursor(mainPlot.svcursorlayer, index);
        }
        else {
            // Fall back to _svcursorLowerLayer in case the requested subplot doesn't exist.
            // This can happen if you reference the svcursor to an x / y axis combination
            // that doesn't have any data on it (and layer is below)
            drawSvcursor(gd._fullLayout._svcursorLowerLayer, index);
        }
    }

    function drawSvcursor(svcursorLayer, index) {

        var ax = Axes.getFromId(gd, options.xref);

        options.x = fixXValue(options.x, ax);
        var id = 'cursorGroup_' + index;
        var attrs = {
                'data-index': index,
                'fill-rule': 'evenodd',
                d: getPathString(gd, options)
            },

            lineColor = options.line.width ?
                options.line.color : 'rgba(0,0,0,0)';

        // var cursorGroup = svcursorLayer.append('g');


        var cursorGroup = Lib.ensureSingleById(svcursorLayer, 'g', id);

        cursorGroup.classed(CURSOR_GROUP_CLASS, true);


        var path = cursorGroup.append('path')
            .attr(attrs)
            .style('opacity', options.opacity)
            .call(Color.stroke, lineColor)
            .call(Color.fill, options.fillcolor)
            .call(Drawing.dashLine, options.line.dash, options.line.width);
        // To support context menu
        // .on("contextmenu", function (d, i) {
        //     d3.event.preventDefault();
        //     if(d3.event.button === 2) {
        //       console.log('right click')
        //     } else {
        //       console.log('left click')
        //     }
        //   });

        // note that for layer="below" the clipAxes can be different from the
        // subplot we're drawing this in. This could cause problems if the svcursor
        // spans two subplots. See https://github.com/plotly/plotly.js/issues/1452
        // var clipAxes = (options.xref + "options.yref").replace(/paper/g, '');

        // path.call(Drawing.setClipUrl, clipAxes ?
        //     ('clip' + gd._fullLayout._uid + clipAxes) :
        //     null
        // );

        // var subplots = gd._fullLayout._subplots.cartesian;

        // var hoverData = initHoverData(gd, subplots, options);
        // var fullLayout = gd._fullLayout;

        // var labelOpts = {
        //     hovermode: "x",
        //     rotateLabels: false,
        //     bgColor: Color.background || "green",
        //     container: svcursorLayer,
        //     outerContainer: fullLayout._paperdiv,
        //     commonLabelOpts: fullLayout.hoverlabel,
        //     hoverdistance: fullLayout.hoverdistance
        // };

        // createHoverText(hoverData, labelOpts, gd, options, cursorGroup);

        createLabels(gd, options, cursorGroup, svcursorLayer);

        // if(gd._context.edits.svcursorPosition) setupDragElement(gd, path, options, index);
        // Always support dragging
        setupDragElement(gd, path, options, index, cursorGroup);
    }
}


function initHoverData(gd, subplot, svcursorOptions) {
    if(!subplot) subplot = 'xy';

    // if the user passed in an array of subplots,
    // use those instead of finding overlayed plots
    var subplots = Array.isArray(subplot) ? subplot : [subplot];

    var fullLayout = gd._fullLayout;
    var plots = fullLayout._plots || [];
    var plotinfo = plots[subplot];
    var hasCartesian = fullLayout._has('cartesian');

    // list of all overlaid subplots to look at
    if(plotinfo) {
        var overlayedSubplots = plotinfo.overlays.map(function(pi) {
            return pi.id;
        });

        subplots = subplots.concat(overlayedSubplots);
    }

    var len = subplots.length;
    var xaArray = new Array(len);
    var yaArray = new Array(len);

    for(var i = 0; i < len; i++) {
        var spId = subplots[i];

        // 'cartesian' case
        var plotObj = plots[spId];
        if(plotObj) {

            // TODO make sure that fullLayout_plots axis refs
            // get updated properly so that we don't have
            // to use Axes.getFromId in general.

            xaArray[i] = Axes.getFromId(gd, plotObj.xaxis._id);
            yaArray[i] = Axes.getFromId(gd, plotObj.yaxis._id);
            continue;
        }

        // other subplot types
        var _subplot = fullLayout[spId]._subplot;
        xaArray[i] = _subplot.xaxis;
        yaArray[i] = _subplot.yaxis;
    }

    // /////////////////////

    var hoverdistance = fullLayout.hoverdistance === -1 ? Infinity : fullLayout.hoverdistance;
    var spikedistance = fullLayout.spikedistance === -1 ? Infinity : fullLayout.spikedistance;
    // the pixel distance to beat as a matching point
    // in 'x' or 'y' mode this resets for each trace
    var distance = Infinity;

    var hoverData = [],

        // searchData: the data to search in. Mostly this is just a copy of
        // gd.calcdata, filtered to the subplot and overlays we're on
        // but if a point array is supplied it will be a mapping
        // of indicated curves
        searchData = [],

        // [x|y]valArray: the axis values of the hover event
        // mapped onto each of the currently selected overlaid subplots
        //  xvalArray,
        //  yvalArray,

        // used in loops
        //   itemnum,
        curvenum,
        cd,
        trace,
        subplotId,
        subploti,
        xval,
        yval,
        pointData,
        // spikePoints: the set of candidate points we've found to draw cursors to
        spikePoints = {
            hLinePoint: null,
            vLinePoint: null
        };
    // /////////////////

    for(curvenum = 0; curvenum < gd.calcdata.length; curvenum++) {
        cd = gd.calcdata[curvenum];
        trace = cd[0].trace;
        if(subplots.indexOf(fx_helpers.getSubplot(trace)) !== -1) {
            searchData.push(cd);
        }
    }

    // find the closest point in each trace
    // this is minimum dx and/or dy, depending on mode
    // and the pixel position for the label (labelXpx, labelYpx)
    for(curvenum = 0; curvenum < searchData.length; curvenum++) {
        cd = searchData[curvenum];

        // filter out broken data
        if(!cd || !cd[0] || !cd[0].trace) continue;

        trace = cd[0].trace;


        subplotId = fx_helpers.getSubplot(trace);
        subploti = subplots.indexOf(subplotId);

        // within one trace mode can sometimes be overridden
        // mode = 'x';

        // container for new point, also used to pass info into module.hoverPoints
        pointData = {
            // trace properties
            cd: cd,
            trace: trace,
            xa: xaArray[subploti],
            ya: yaArray[subploti],

            // max distances for hover and spikes - for points that want to show but do not
            // want to override other points, set distance/spikeDistance equal to max*Distance
            // and it will not get filtered out but it will be guaranteed to have a greater
            // distance than any point that calculated a real distance.
            maxHoverDistance: hoverdistance,
            maxSpikeDistance: spikedistance,

            // point properties - override all of these
            index: false, // point index in trace - only used by plotly.js hoverdata consumers
            distance: Math.min(distance, hoverdistance), // pixel distance or pseudo-distance

            // distance/pseudo-distance for spikes. This distance should always be calculated
            // as if in "closest" mode, and should only be set if this point should
            // generate a spike.
            spikeDistance: Infinity,

            // in some cases the spikes have different positioning from the hover label
            // they don't need x0/x1, just one position
            xSpike: undefined,
            ySpike: undefined,

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

        // closedataPreviousLength = hoverData.length;

        // var xval = xvalArray[subploti];
        // var yval = yvalArray[subploti];
        xval = svcursorOptions.x;
        yval = 0;

        // Now if there is range to look in, find the points to hover.
        // if(hoverdistance !== 0) {
        if(trace._module && trace._module.hoverPoints) {
            var newPoints = hoverPoints(pointData, xval, yval, svcursorOptions.cursorMode);
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
        else {
            Lib.log('Unrecognized trace type in hover:', trace);
        }
        // }

    }

    function hoverPoints(pointData, xval, yval) {
        var cd = pointData.cd;
        var trace = cd[0].trace;
        var xa = pointData.xa;
        var ya = pointData.ya;
        var xpx = xa.c2p(xval);
        var ypx = ya.c2p(yval);
        var minRad = (trace.mode.indexOf('markers') !== -1) ? 3 : 0.5;


        // if (hoveron.indexOf('lines') !== -1) {
        var dx = function(di) {
            // dx and dy are used in compare modes - here we want to always
            // prioritize the closest data point, at least as long as markers are
            // the same size or nonexistent, but still try to prioritize small markers too.
            var rad = Math.max(3, di.mrc || 0);
            var kink = 1 - 1 / rad;
            var dxRaw = Math.abs(xa.c2p(di.x) - xpx);
            var d = (dxRaw < rad) ? (kink * dxRaw / rad) : (dxRaw - rad + kink);
            return d;
        };
        var dy = function(di) {
            var rad = Math.max(3, di.mrc || 0);
            var kink = 1 - 1 / rad;
            var dyRaw = Math.abs(ya.c2p(di.y) - ypx);
            return (dyRaw < rad) ? (kink * dyRaw / rad) : (dyRaw - rad + kink);
        };
        var dxy = function(di) {
            // scatter points: d.mrc is the calculated marker radius
            // adjust the distance so if you're inside the marker it
            // always will show up regardless of point size, but
            // prioritize smaller points
            var rad = Math.max(minRad, di.mrc || 0);
            var dx = xa.c2p(di.x) - xpx;
            var dy = ya.c2p(di.y) - ypx;
            return Math.max(Math.sqrt(dx * dx + dy * dy) - rad, 1 - minRad / rad);
        };
        var distfn = Fx.getDistanceFunction('x', dx, dy, dxy);

        var x0, y0, x1, y1, xx, yy;

        function getIntersectionPoint() {
            var shape = trace.line.shape;

            if(shape === 'hv') {
                if(xx < x1) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(shape === 'vh') {
                if(xx > x0) {
                    return y1;
                } else {
                    return y0;
                }
            }

            if(shape === 'hvh') {
                if(xx < (x0 + x1) / 2) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(shape === 'vhv') {
                if(xx > x0) {
                    return (y0 + y1) / 2;
                } else {
                    return y0;
                }
            }

            if(shape === 'linear') {
                return (xx - x0) * (y1 - y0) / (x1 - x0) + y0;
            }

            return null;
        }

        // Be sure that we wil be able to find at least one point
        if(isNaN(pointData.distance)) {
            pointData.distance = 10000;
        }
        Fx.getClosest(cd, distfn, pointData);

        // skip the rest (for this trace) if we didn't find a close point
        if(pointData.index !== false) {

            // the closest data point
            var di = cd[pointData.index];

            var intersect = false;

            x0 = di.x;
            y0 = di.y;
            x1 = di.x;
            y1 = di.y;
            xx = xa.p2c(xpx);
            yy = di.y;

            var leftPoint = pointData.index;
            var rightPoint = pointData.index;

            if(di.x > xx && pointData.index > 0) {
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

                // if(['hv', 'vh', 'hvh', 'vhv'].indexOf(line.shape) !== -1) {
                yy = getIntersectionPoint();
                // }
                // yy = (xx - x0) * (y1 - y0) / (x1 - x0) + y0;

            } else {
                yy = null;
            }

            var xc = xpx;
            var yc = ya.c2p(yy);

            Lib.extendFlat(pointData, {
                color: getTraceColor(trace, di),

                x0: xc,
                x1: xc,
                xLabelVal: xx,

                y0: yc,
                y1: yc,
                yLabelVal: yy,

                spikeDistance: dxy(di)
            });

            // fillHoverText(di, trace, pointData);
            Registry.getComponentMethod('errorbars', 'hoverInfo')(di, trace, pointData);

            return [pointData];
        }


        // }
    }


    function selectClosestPoint(pointsData, spikedistance) {
        var resultPoint = null;
        var minDistance = Infinity;
        var thisSpikeDistance;
        for(var i = 0; i < pointsData.length; i++) {
            thisSpikeDistance = pointsData[i].spikeDistance;
            if(thisSpikeDistance < minDistance && thisSpikeDistance <= spikedistance) {
                resultPoint = pointsData[i];
                minDistance = thisSpikeDistance;
            }
        }
        return resultPoint;
    }

    function fillSpikePoint(point) {
        if(!point) return null;
        return {
            xa: point.xa,
            ya: point.ya,
            x: point.xSpike !== undefined ? point.xSpike : (point.x0 + point.x1) / 2,
            y: point.ySpike !== undefined ? point.ySpike : (point.y0 + point.y1) / 2,
            distance: point.distance,
            spikeDistance: point.spikeDistance,
            curveNumber: point.trace.index,
            color: point.color,
            pointNumber: point.index
        };
    }

    var newspikepoints = {
        vLinePoint: spikePoints.vLinePoint,
        hLinePoint: spikePoints.hLinePoint
    };
    gd._spikepoints = newspikepoints;

    // Now if it is not restricted by spikedistance option, set the points to draw the spikelines
    if(hasCartesian && (spikedistance !== 0)) {
        if(hoverData.length !== 0) {
            var tmpHPointData = hoverData.filter(function(point) {
                return point.ya.showspikes;
            });
            var tmpHPoint = selectClosestPoint(tmpHPointData, spikedistance);
            spikePoints.hLinePoint = fillSpikePoint(tmpHPoint);

            var tmpVPointData = hoverData.filter(function(point) {
                return point.xa.showspikes;
            });
            var tmpVPoint = selectClosestPoint(tmpVPointData, spikedistance);
            spikePoints.vLinePoint = fillSpikePoint(tmpVPoint);
        }
    }

    return hoverData;
}

function alignHoverText(hoverLabels) {
    // finally set the text positioning relative to the data and draw the
    // box around it
    hoverLabels.each(function(d) {
        var g = d3.select(this);
        if(d.del) {
            g.remove();
            return;
        }
        var horzSign = d.anchor === 'end' ? -1 : 1,
            tx = g.select('text.nums'),
            alignShift = { start: 1, end: -1, middle: 0 }[d.anchor],
            txx = alignShift * (HOVERARROWSIZE + HOVERTEXTPAD),
            tx2x = txx + alignShift * (d.txwidth + HOVERTEXTPAD),
            offsetX = 0,
            offsetY = d.offset;
        if(d.anchor === 'middle') {
            txx -= d.tx2width / 2;
            tx2x += d.txwidth / 2 + HOVERTEXTPAD;
        }
        // if(rotateLabels) {
        //     offsetY *= -YSHIFTY;
        //     offsetX = d.offset * YSHIFTX;
        // }

        g.select('path').attr('d', d.anchor === 'middle' ?
            // middle aligned: rect centered on data
            ('M-' + (d.bx / 2 + d.tx2width / 2) + ',' + (offsetY - d.by / 2) +
                'h' + d.bx + 'v' + d.by + 'h-' + d.bx + 'Z') :
            // left or right aligned: side rect with arrow to data
            ('M0,0L' + (horzSign * HOVERARROWSIZE + offsetX) + ',' + (HOVERARROWSIZE + offsetY) +
                'v' + (d.by / 2 - HOVERARROWSIZE) +
                'h' + (horzSign * d.bx) +
                'v-' + d.by +
                'H' + (horzSign * HOVERARROWSIZE + offsetX) +
                'V' + (offsetY - HOVERARROWSIZE) +
                'Z'));

        tx.call(svgTextUtils.positionText,
            txx + offsetX, offsetY + d.ty0 - d.by / 2 + HOVERTEXTPAD);

        if(d.tx2width) {
            g.select('text.name')
                .call(svgTextUtils.positionText,
                    tx2x + alignShift * HOVERTEXTPAD + offsetX,
                    offsetY + d.ty0 - d.by / 2 + HOVERTEXTPAD);
            g.select('rect')
                .call(Drawing.setRect,
                    tx2x + (alignShift - 1) * d.tx2width / 2 + offsetX,
                    offsetY - d.by / 2 - 1,
                    d.tx2width, d.by + 2);
        }
    });
}


function cleanPoint(d, hovermode) {
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

    // for box means and error bars, add the range to the label
    if(!isNaN(d.xerr) && !(d.xa.type === 'log' && d.xerr <= 0)) {
        var xeText = Axes.tickText(d.xa, d.xa.c2l(d.xerr), 'hover').text;
        if(d.xerrneg !== undefined) {
            d.xLabel += ' +' + xeText + ' / -' +
                Axes.tickText(d.xa, d.xa.c2l(d.xerrneg), 'hover').text;
        }
        else d.xLabel += ' ± ' + xeText;

        // small distance penalty for error bars, so that if there are
        // traces with errors and some without, the error bar label will
        // hoist up to the point
        if(hovermode === 'x') d.distance += 1;
    }
    if(!isNaN(d.yerr) && !(d.ya.type === 'log' && d.yerr <= 0)) {
        var yeText = Axes.tickText(d.ya, d.ya.c2l(d.yerr), 'hover').text;
        if(d.yerrneg !== undefined) {
            d.yLabel += ' +' + yeText + ' / -' +
                Axes.tickText(d.ya, d.ya.c2l(d.yerrneg), 'hover').text;
        }
        else d.yLabel += ' ± ' + yeText;

        if(hovermode === 'y') d.distance += 1;
    }

    var infomode = d.hoverinfo || d.trace.hoverinfo;

    if(infomode !== 'all') {
        infomode = Array.isArray(infomode) ? infomode : infomode.split('+');
        if(infomode.indexOf('x') === -1) d.xLabel = undefined;
        if(infomode.indexOf('y') === -1) d.yLabel = undefined;
        if(infomode.indexOf('text') === -1) d.text = undefined;
        if(infomode.indexOf('name') === -1) d.name = undefined;
    }

    return d;
}


function setupDragElement(gd, svcursorPath, svcursorOptions, index, cursorGroup) {
    var MINWIDTH = 10,
        MINHEIGHT = 10;

    var update;
    var x0, y0, y1, astrX0, astrY0, astrY1;
    // var n0, s0, w0, e0, astrN, astrS, astrW, astrE, optN, optS, optW, optE;
    var pathIn, astrPath;

    var xa, ya, x2p, y2p, p2x, p2y;

    var dragOptions = {
            element: svcursorPath.node(),
            gd: gd,
            prepFn: startDrag,
            doneFn: endDrag,
            curX: svcursorOptions.x
        },
        dragBBox = dragOptions.element.getBoundingClientRect();
    // dragMode;

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

        // possible values 'move', 'sw', 'w', 'se', 'e', 'ne', 'n', 'nw' and 'w'
        // dragMode = cursor.split('-')[0];

    }

    function startDrag(evt) {
        // setup conversion functions
        xa = Axes.getFromId(gd, svcursorOptions.xref);
        ya = Axes.getFromId(gd, svcursorOptions.yref);

        svcursorOptions.x = fixXValue(svcursorOptions.x, xa);

        x2p = helpersShape.getDataToPixel(gd, xa);
        y2p = helpersShape.getDataToPixel(gd, ya, true);
        p2x = helpersShape.getPixelToData(gd, xa);
        p2y = helpersShape.getPixelToData(gd, ya, true);

        // setup update strings and initial values
        var astr = 'svcursors[' + index + ']';
        if(svcursorOptions.type === 'path') {
            pathIn = svcursorOptions.path;
            astrPath = astr + '.path';
        }
        else {
            x0 = x2p(svcursorOptions.x);
            // y0 = y2p(svcursorOptions.y0);
            // 11
            // x1 = x2p(svcursorOptions.x);
            // y1 = y2p(svcursorOptions.y1);

            astrX0 = astr + '.x';
            astrY0 = astr + '.y0';
            // 11
            // astrX1 = astr + '.x';
            astrY1 = astr + '.y1';
        }

        // 11
        // if(x0 < x1) {
        //     w0 = x0; astrW = astr + '.x0'; optW = 'x0';
        //     e0 = x1; astrE = astr + '.x1'; optE = 'x1';
        // }
        // else {
        //     w0 = x1; astrW = astr + '.x1'; optW = 'x1';
        //     e0 = x0; astrE = astr + '.x0'; optE = 'x0';
        // }

        // w0 = x1; astrW = astr + '.x'; optW = 'x';
        // e0 = x0; astrE = astr + '.x'; optE = 'x';

        // if(y0 < y1) {
        //     n0 = y0; astrN = astr + '.y0'; optN = 'y0';
        //     s0 = y1; astrS = astr + '.y1'; optS = 'y1';
        // }
        // else {
        //     n0 = y1; astrN = astr + '.y1'; optN = 'y1';
        //     s0 = y0; astrS = astr + '.y0'; optS = 'y0';
        // }

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
        Registry.call('relayout', gd, update);
    }

    function movesvcursor(dx) {
        if(svcursorOptions.cursorMode === 'frozen') {
            return;
        }
        if(svcursorOptions.type === 'path') {
            var moveX = function moveX(x) { return p2x(x2p(x) + dx); };
            if(xa && xa.type === 'date') moveX = helpersShape.encodeDate(moveX);

            // var moveY = function moveY(y) { return p2y(y2p(y) + dy); };
            // Y will never changed
            var moveY = function moveY(y) { return p2y(y2p(y)); };
            if(ya && ya.type === 'date') moveY = helpersShape.encodeDate(moveY);

            svcursorOptions.path = movePath(pathIn, moveX, moveY);
            update[astrPath] = svcursorOptions.path;
        }
        else {
            // Y will never changed

            var newX = fixXValue(p2x(x0 + dx), xa);


            if(newX !== null) {
                update[astrX0] = svcursorOptions.x = newX;
                update[astrY0] = svcursorOptions.y0 = p2y(y0);
                // 11
                // update[astrX1] = svcursorOptions.x1 = p2x(x0 + dx);
                update[astrY1] = svcursorOptions.y1 = p2y(y1);
            }
        }


        svcursorPath.attr('d', getPathString(gd, svcursorOptions));

        var svcursorLayer = gd._fullLayout._svcursorUpperLayer;
        // var fullLayout = gd._fullLayout;
        // var labelOpts = {
        //     hovermode: "x",
        //     rotateLabels: false,
        //     bgColor:  Color.background || "green",
        //     container: svcursorLayer,
        //     outerContainer: fullLayout._paperdiv,
        //     commonLabelOpts: fullLayout.hoverlabel,
        //     hoverdistance: fullLayout.hoverdistance
        // };

        // var subplots = gd._fullLayout._subplots.cartesian;
        // var hoverData = initHoverData(gd, subplots, svcursorOptions);
        // createHoverText(hoverData, labelOpts, gd, svcursorOptions, cursorGroup);

        createLabels(gd, svcursorOptions, cursorGroup, svcursorLayer);

    }


}

function getPathString(gd, options) {

    var type = options.type,
        xa = Axes.getFromId(gd, options.xref),
        ya = Axes.getFromId(gd, options.yref),
        gs = gd._fullLayout._size,
        x2r,
        x2p,
        y2r,
        y2p;

    if(xa) {
        x2r = helpersShape.shapePositionToRange(xa);
        x2p = function(v) { return xa._offset + xa.r2p(x2r(v, true)); };
    }
    else {
        x2p = function(v) { return gs.l + gs.w * v; };
    }

    if(ya) {
        y2r = helpersShape.shapePositionToRange(ya);
        y2p = function(v) { return ya._offset + ya.r2p(y2r(v, true)); };
    }
    else {
        y2p = function(v) { return gs.t + gs.h * (1 - v); };
    }

    if(type === 'path') {
        if(xa && xa.type === 'date') x2p = helpersShape.decodeDate(x2p);
        if(ya && ya.type === 'date') y2p = helpersShape.decodeDate(y2p);
        return convertPath(options.path, x2p, y2p);
    }

    var x0 = x2p(options.x),
        // 11
        x1 = x2p(options.x);
    // y0 = y2p(options.y0),
    // y1 = y2p(options.y1);

    var y0 = xa._counterSpan[0];
    var y1 = xa._counterSpan[1];

    return 'M' + x0 + ',' + y0 + 'L' + x1 + ',' + y1;
    // if(type === 'line') return 'M' + x0 + ',' + y0 + 'L' + x1 + ',' + y1;
    // if(type === 'rect') return 'M' + x0 + ',' + y0 + 'H' + x1 + 'V' + y1 + 'H' + x0 + 'Z';
    // circle
    // var cx = (x0 + x1) / 2,
    //     cy = (y0 + y1) / 2,
    //     rx = Math.abs(cx - x0),
    //     ry = Math.abs(cy - y0),
    //     rArc = 'A' + rx + ',' + ry,
    //     rightPt = (cx + rx) + ',' + cy,
    //     topPt = cx + ',' + (cy - ry);
    // return 'M' + rightPt + rArc + ' 0 1,1 ' + topPt +
    //     rArc + ' 0 0,1 ' + rightPt + 'Z';
}


function convertPath(pathIn, x2p, y2p) {
    // convert an SVG path string from data units to pixels
    return pathIn.replace(constants.segmentRE, function(segment) {
        var paramNumber = 0,
            segmentType = segment.charAt(0),
            xParams = constants.paramIsX[segmentType],
            yParams = constants.paramIsY[segmentType],
            nParams = constants.numParams[segmentType];

        var paramString = segment.substr(1).replace(constants.paramRE, function(param) {
            if(xParams[paramNumber]) param = x2p(param);
            else if(yParams[paramNumber]) param = y2p(param);
            paramNumber++;

            if(paramNumber > nParams) param = 'X';
            return param;
        });

        if(paramNumber > nParams) {
            paramString = paramString.replace(/[\s,]*X.*/, '');
            Lib.log('Ignoring extra params in segment ' + segment);
        }

        return segmentType + paramString;
    });
}

function movePath(pathIn, moveX, moveY) {
    return pathIn.replace(constants.segmentRE, function(segment) {
        var paramNumber = 0,
            segmentType = segment.charAt(0),
            xParams = constants.paramIsX[segmentType],
            yParams = constants.paramIsY[segmentType],
            nParams = constants.numParams[segmentType];

        var paramString = segment.substr(1).replace(constants.paramRE, function(param) {
            if(paramNumber >= nParams) return param;

            if(xParams[paramNumber]) param = moveX(param);
            else if(yParams[paramNumber]) param = moveY(param);

            paramNumber++;

            return param;
        });

        return segmentType + paramString;
    });
}


function createHoverText(hoverData, opts, gd, svcursorOptions, cursorGroup) {
    var hovermode = opts.hovermode;
    var rotateLabels = opts.rotateLabels;
    var bgColor = opts.bgColor;
    var container = cursorGroup;// opts.container;
    var outerContainer = opts.outerContainer;
    var commonLabelOpts = opts.commonLabelOpts || {};
    var showCommonLabel = true;

    // opts.fontFamily/Size are used for the common label
    // and as defaults for each hover label, though the individual labels
    // can override this.
    var fontFamily = opts.fontFamily || constantsFx.HOVERFONT;
    var fontSize = opts.fontSize || constantsFx.HOVERFONTSIZE;

    // var c0 = hoverData[0];
    // var xa = c0.xa;
    // var ya = c0.ya;

    var xa = Axes.getFromId(gd, svcursorOptions.xref);
    var ya = Axes.getFromId(gd, svcursorOptions.yref);
    var x2p = helpersShape.getDataToPixel(gd, xa);
    var x0 = x2p(svcursorOptions.x);

    // var ya = c0.ya;
    // var commonAttr = hovermode === 'y' ? 'yLabel' : 'xLabel';
    // var t0 = c0[commonAttr];
    var t0 = Axes.hoverLabelText(xa, svcursorOptions.x);
    // var t00 = (String(t0) || '').split(' ')[0];

    var outerContainerBB = outerContainer.node().getBoundingClientRect();
    var outerTop = outerContainerBB.top;
    var outerWidth = outerContainerBB.width;
    var outerHeight = outerContainerBB.height;

    var commonLabel = cursorGroup.selectAll('g.' + CURSOR_AXIS_LABEL_CLASS)
        .data(showCommonLabel ? [0] : []);
    commonLabel.enter().append('g')
        .classed(CURSOR_AXIS_LABEL_CLASS, true);
    commonLabel.exit().remove();

    commonLabel.each(function() {
        var label = d3.select(this);
        var lpath = Lib.ensureSingle(label, 'path', 'aaa', function(s) {
            s.style({ 'stroke-width': '1px' });
        });

        var ltext = Lib.ensureSingle(label, 'text', 'aaa', function(s) {
            // prohibit tex interpretation until we can handle
            // tex and regular text together
            s.attr('data-notex', 1);
        });


        lpath.style({
            fill: commonLabelOpts.bgcolor || Color.defaultLine,
            stroke: commonLabelOpts.bordercolor || Color.background,
        });


        ltext.text(t0)
            .call(Drawing.font,
                commonLabelOpts.font.family || fontFamily,
                commonLabelOpts.font.size || fontSize,
                commonLabelOpts.font.color || Color.background
            )
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        label.attr('transform', '');

        var tbb = ltext.node().getBoundingClientRect();
        if(hovermode === 'x') {


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
        }
        else {
            ltext.attr('text-anchor', ya.side === 'right' ? 'start' : 'end')
                .call(svgTextUtils.positionText,
                    (ya.side === 'right' ? 1 : -1) * (HOVERTEXTPAD + HOVERARROWSIZE),
                    outerTop - tbb.top - tbb.height / 2);

            var leftsign = ya.side === 'right' ? '' : '-';
            lpath.attr('d', 'M0,0' +
                'L' + leftsign + HOVERARROWSIZE + ',' + HOVERARROWSIZE +
                'V' + (HOVERTEXTPAD + tbb.height / 2) +
                'h' + leftsign + (HOVERTEXTPAD * 2 + tbb.width) +
                'V-' + (HOVERTEXTPAD + tbb.height / 2) +
                'H' + leftsign + HOVERARROWSIZE + 'V-' + HOVERARROWSIZE + 'Z');

            label.attr('transform', 'translate(' +
                (xa._offset + (ya.side === 'right' ? xa._length : 0)) + ',' +
                (ya._offset) + ')');
        }
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
            name = '',
            text = '';

        // combine possible non-opaque trace color with bgColor
        var baseColor = Color.opacity(d.color) ? d.color : Color.defaultLine;
        var traceColor = Color.combine(baseColor, bgColor);

        // find a contrasting color for border and text
        var contrastColor = d.borderColor || Color.contrast(traceColor);

        // to get custom 'name' labels pass cleanPoint
        if(d.nameOverride !== undefined) d.name = d.nameOverride;

        // if(d.name) {
        //     // strip out our pseudo-html elements from d.name (if it exists at all)
        //     name = svgTextUtils.plainText(d.name || '');

        //     var nameLength = Math.round(d.nameLength);

        //     if(nameLength > -1 && name.length > nameLength) {
        //         if(nameLength > 3) name = name.substr(0, nameLength - 3) + '...';
        //         else name = name.substr(0, nameLength);
        //     }
        // }

        // used by other modules (initially just ternary) that
        // manage their own hoverinfo independent of cleanPoint
        // the rest of this will still apply, so such modules
        // can still put things in (x|y|z)Label, text, and name
        // and hoverinfo will still determine their visibility
        if(d.extraText !== undefined) text += d.extraText;

        // if(d.zLabel !== undefined) {
        //     if(d.xLabel !== undefined) text += 'x: ' + d.xLabel + '<br>';
        //     if(d.yLabel !== undefined) text += 'y: ' + d.yLabel + '<br>';
        //     text += (text ? 'z: ' : '') + d.zLabel;
        // }
        // else if(showCommonLabel && d[hovermode + 'Label'] === t0) {
        //     text = d[(hovermode === 'x' ? 'y' : 'x') + 'Label'] || '';
        // }
        // else if(d.xLabel === undefined) {
        //     if(d.yLabel !== undefined) text = d.yLabel;
        // }
        // else if(d.yLabel === undefined) text = d.xLabel;
        // else text = '(' + d.xLabel + ', ' + d.yLabel + ')';

        // if(d.text && !Array.isArray(d.text)) {
        //     text += (text ? '<br>' : '') + d.text;
        // }

        text = d.yLabel;
        // if 'text' is empty at this point,
        // put 'name' in main label and don't show secondary label
        if(text === '') {
            // if 'name' is also empty, remove entire label
            if(name === '') g.remove();
            text = name;
        }

        // main label
        var tx = g.select('text.nums')
            .call(Drawing.font,
                d.fontFamily || fontFamily,
                d.fontSize || fontSize,
                d.fontColor || contrastColor)
            .text(text)
            .attr('data-notex', 1)
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        var tx2 = g.select('text.name'),
            tx2width = 0;

        // secondary label for non-empty 'name'
        if(name && name !== text) {
            tx2.call(Drawing.font,
                d.fontFamily || fontFamily,
                d.fontSize || fontSize,
                traceColor)
                .text(name)
                .attr('data-notex', 1)
                .call(svgTextUtils.positionText, 0, 0)
                .call(svgTextUtils.convertToTspans, gd);
            tx2width = tx2.node().getBoundingClientRect().width + 2 * HOVERTEXTPAD;
        }
        else {
            tx2.remove();
            g.select('rect').remove();
        }

        g.select('path')
            .style({
                fill: traceColor,
                stroke: contrastColor
            });
        var tbb = tx.node().getBoundingClientRect(),
            htx = d.xa._offset + (d.x0 + d.x1) / 2,
            hty = d.ya._offset + (d.y0 + d.y1) / 2,
            dx = Math.abs(d.x1 - d.x0),
            dy = Math.abs(d.y1 - d.y0),
            txTotalWidth = tbb.width + HOVERARROWSIZE + HOVERTEXTPAD + tx2width,
            anchorStartOK,
            anchorEndOK;

        d.ty0 = outerTop - tbb.top;
        d.bx = tbb.width + 2 * HOVERTEXTPAD;
        d.by = tbb.height + 2 * HOVERTEXTPAD;
        d.anchor = 'start';
        d.txwidth = tbb.width;
        d.tx2width = tx2width;
        d.offset = 0;

        if(rotateLabels) {
            d.pos = htx;
            anchorStartOK = hty + dy / 2 + txTotalWidth <= outerHeight;
            anchorEndOK = hty - dy / 2 - txTotalWidth >= 0;
            if((d.idealAlign === 'top' || !anchorStartOK) && anchorEndOK) {
                hty -= dy / 2;
                d.anchor = 'end';
            } else if(anchorStartOK) {
                hty += dy / 2;
                d.anchor = 'start';
            } else d.anchor = 'middle';
        }
        else {
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
        }

        tx.attr('text-anchor', d.anchor);
        if(tx2width) tx2.attr('text-anchor', d.anchor);
        g.attr('transform', 'translate(' + htx + ',' + hty + ')' +
            (rotateLabels ? 'rotate(' + YANGLE + ')' : ''));
    });

    var fullLayout = gd._fullLayout;

    hoverAvoidOverlaps(hoverData, rotateLabels ? 'xa' : 'ya', fullLayout);
    alignHoverText(hoverLabels, rotateLabels);
    return hoverLabels;
}

function createLabels(gd, svcursorOptions, cursorGroup, svcursorLayer) {

    var fullLayout = gd._fullLayout;
    var labelOpts = {
        hovermode: 'x',
        rotateLabels: false,
        bgColor: Color.background || 'green',
        container: svcursorLayer,
        outerContainer: fullLayout._paperdiv,
        commonLabelOpts: fullLayout.hoverlabel,
        hoverdistance: fullLayout.hoverdistance
    };

    var subplots = gd._fullLayout._subplots.cartesian;
    var hoverData = initHoverData(gd, subplots, svcursorOptions);
    createHoverText(hoverData, labelOpts, gd, svcursorOptions, cursorGroup);
}

// Make groups of touching points, and within each group
// move each point so that no labels overlap, but the average
// label position is the same as it was before moving. Indicentally,
// this is equivalent to saying all the labels are on equal linear
// springs about their initial position. Initially, each point is
// its own group, but as we find overlaps we will clump the points.
//
// Also, there are hard constraints at the edges of the graphs,
// that push all groups to the middle so they are visible. I don't
// know what happens if the group spans all the way from one edge to
// the other, though it hardly matters - there's just too much
// information then.
function hoverAvoidOverlaps(hoverData, ax, fullLayout) {
    var nummoves = 0,

        // make groups of touching points
        pointgroups = hoverData
            .map(function(d, i) {
                var axis = d[ax];
                return [{
                    i: i,
                    dp: 0,
                    pos: d.pos,
                    posref: d.posref,
                    size: d.by * (axis._id.charAt(0) === 'x' ? YFACTOR : 1) / 2,
                    pmin: 0,
                    pmax: (axis._id.charAt(0) === 'x' ? fullLayout.width : fullLayout.height)
                }];
            })
            .sort(function(a, b) { return a[0].posref - b[0].posref; }),
        donepositioning,
        topOverlap,
        bottomOverlap,
        i, j,
        pti,
        sumdp;

    function constrainGroup(grp) {
        var minPt = grp[0],
            maxPt = grp[grp.length - 1];

        // overlap with the top - positive vals are overlaps
        topOverlap = minPt.pmin - minPt.pos - minPt.dp + minPt.size;

        // overlap with the bottom - positive vals are overlaps
        bottomOverlap = maxPt.pos + maxPt.dp + maxPt.size - minPt.pmax;

        // check for min overlap first, so that we always
        // see the largest labels
        // allow for .01px overlap, so we don't get an
        // infinite loop from rounding errors
        if(topOverlap > 0.01) {
            for(j = grp.length - 1; j >= 0; j--) grp[j].dp += topOverlap;
            donepositioning = false;
        }
        if(bottomOverlap < 0.01) return;
        if(topOverlap < -0.01) {
            // make sure we're not pushing back and forth
            for(j = grp.length - 1; j >= 0; j--) grp[j].dp -= bottomOverlap;
            donepositioning = false;
        }
        if(!donepositioning) return;

        // no room to fix positioning, delete off-screen points

        // first see how many points we need to delete
        var deleteCount = 0;
        for(i = 0; i < grp.length; i++) {
            pti = grp[i];
            if(pti.pos + pti.dp + pti.size > minPt.pmax) deleteCount++;
        }

        // start by deleting points whose data is off screen
        for(i = grp.length - 1; i >= 0; i--) {
            if(deleteCount <= 0) break;
            pti = grp[i];

            // pos has already been constrained to [pmin,pmax]
            // so look for points close to that to delete
            if(pti.pos > minPt.pmax - 1) {
                pti.del = true;
                deleteCount--;
            }
        }
        for(i = 0; i < grp.length; i++) {
            if(deleteCount <= 0) break;
            pti = grp[i];

            // pos has already been constrained to [pmin,pmax]
            // so look for points close to that to delete
            if(pti.pos < minPt.pmin + 1) {
                pti.del = true;
                deleteCount--;

                // shift the whole group minus into this new space
                bottomOverlap = pti.size * 2;
                for(j = grp.length - 1; j >= 0; j--) grp[j].dp -= bottomOverlap;
            }
        }
        // then delete points that go off the bottom
        for(i = grp.length - 1; i >= 0; i--) {
            if(deleteCount <= 0) break;
            pti = grp[i];
            if(pti.pos + pti.dp + pti.size > minPt.pmax) {
                pti.del = true;
                deleteCount--;
            }
        }
    }

    // loop through groups, combining them if they overlap,
    // until nothing moves
    while(!donepositioning && nummoves <= hoverData.length) {
        // to avoid infinite loops, don't move more times
        // than there are traces
        nummoves++;

        // assume nothing will move in this iteration,
        // reverse this if it does
        donepositioning = true;
        i = 0;
        while(i < pointgroups.length - 1) {
            // the higher (g0) and lower (g1) point group
            var g0 = pointgroups[i],
                g1 = pointgroups[i + 1],

                // the lowest point in the higher group (p0)
                // the highest point in the lower group (p1)
                p0 = g0[g0.length - 1],
                p1 = g1[0];
            topOverlap = p0.pos + p0.dp + p0.size - p1.pos - p1.dp + p1.size;

            // Only group points that lie on the same axes
            if(topOverlap > 0.01 && (p0.pmin === p1.pmin) && (p0.pmax === p1.pmax)) {
                // push the new point(s) added to this group out of the way
                for(j = g1.length - 1; j >= 0; j--) g1[j].dp += topOverlap;

                // add them to the group
                g0.push.apply(g0, g1);
                pointgroups.splice(i + 1, 1);

                // adjust for minimum average movement
                sumdp = 0;
                for(j = g0.length - 1; j >= 0; j--) sumdp += g0[j].dp;
                bottomOverlap = sumdp / g0.length;
                for(j = g0.length - 1; j >= 0; j--) g0[j].dp -= bottomOverlap;
                donepositioning = false;
            }
            else i++;
        }

        // check if we're going off the plot on either side and fix
        pointgroups.forEach(constrainGroup);
    }

    // now put these offsets into hoverData
    for(i = pointgroups.length - 1; i >= 0; i--) {
        var grp = pointgroups[i];
        for(j = grp.length - 1; j >= 0; j--) {
            var pt = grp[j],
                hoverPt = hoverData[pt.i];
            hoverPt.offset = pt.dp;
            hoverPt.del = pt.del;
        }
    }
}

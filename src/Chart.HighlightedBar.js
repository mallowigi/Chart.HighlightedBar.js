(function () {
  "use strict";

  var root = this,
      Chart = root.Chart,
      helpers = Chart.helpers;

  var defaultConfig = {
    //Boolean - Whether the scale should start at zero, or an order of magnitude down from the lowest value
    scaleBeginAtZero: true,

    //Boolean - Whether grid lines are shown across the chart
    scaleShowGridLines: true,

    //String - Colour of the grid lines
    scaleGridLineColor: "rgba(0,0,0,.05)",

    //Number - Width of the grid lines
    scaleGridLineWidth: 1,

    //Boolean - Whether to show horizontal lines (except X axis)
    scaleShowHorizontalLines: true,

    //Boolean - Whether to show vertical lines (except Y axis)
    scaleShowVerticalLines: true,

    //Boolean - If there is a stroke on each bar
    barShowStroke: true,

    //Number - Pixel width of the bar stroke
    barStrokeWidth: 2,

    //Number - Spacing between each of the X value sets
    barValueSpacing: 5,

    //Number - Spacing between data sets within X values
    barDatasetSpacing: 1,

    //String - A legend template
    legendTemplate: "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].fillColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"

  };

  Chart.Type.extend({
    name: "HighlightedBar",
    defaults: defaultConfig,

    /**
     * Initialize the highlightedBar
     * @param data
     */
    initialize: function initialize (data) {

      //Expose options as a scope variable here so we can access it in the ScaleClass
      var options = this.options;

      // Override ScaleClass methods
      this.ScaleClass = Chart.Scale.extend({
        offsetGridLines: true,
        calculateBarX: function calculateBarX (datasetCount, datasetIndex, barIndex) {
          //Reusable method for calculating the xPosition of a given bar based on datasetIndex & width of the bar
          var xWidth = this.calculateBaseWidth(),
              xAbsolute = this.calculateX(barIndex) - (xWidth / 2),
              barWidth = this.calculateBarWidth(datasetCount);

          return xAbsolute + (barWidth * datasetIndex) + (datasetIndex * options.barDatasetSpacing) + barWidth / 2;
        },

        calculateBaseWidth: function calculateBaseWidth () {
          return (this.calculateX(1) - this.calculateX(0)) - (2 * options.barValueSpacing);
        },

        calculateBarWidth: function calculateBarWidth (datasetCount) {
          //The padding between datasets is to the right of each bar, providing that there are more than 1 dataset
          var baseWidth = this.calculateBaseWidth() - ((datasetCount - 1) * options.barDatasetSpacing);

          return (baseWidth / datasetCount);
        }
      });

      // The chart datasets
      this.datasets = [];

      // NEW: The chart active bars
      this.activeBars = [];

      //Set up tooltip events on the chart
      if (this.options.showTooltips) {

        // on tooltipEvents (click, mouseover, mouseout...)
        helpers.bindEvents(this, this.options.tooltipEvents, function (evt) {
          var activeBars = (evt.type !== 'mouseout') ? this.getBarsAtEvent(evt) : [];

          // For each of the bars, restore their fill and stroke color
          this.eachBars(function (bar) {
            bar.restore(['fillColor', 'strokeColor']);
          });

          // For each of the hovered/clicked bars, set their highlighted color
          helpers.each(activeBars, function (activeBar) {
            activeBar.fillColor = activeBar.highlightFill;
            activeBar.strokeColor = activeBar.highlightStroke;
          });

          // NEW: For each of the activeBars, set their color to highlighted
          this.highlightActiveBars();

          // Show the tooltip
          this.showTooltip(activeBars);
        });
      }

      // Define the BarClass as a Rectangle
      this.BarClass = Chart.Rectangle.extend({
        strokeWidth: this.options.barStrokeWidth,
        showStroke: this.options.barShowStroke,
        ctx: this.chart.ctx
      });

      // Iterate through each of the datasets, and build the bars
      helpers.each(data.datasets, function (dataset, datasetIndex) {

        // A DataSetObject contains a label, a fillColor and a strokeColor, and of course the bars that will contain the BarClasses
        var datasetObject = {
          label: dataset.label || null,
          fillColor: dataset.fillColor,
          strokeColor: dataset.strokeColor,
          bars: []
        };

        this.datasets.push(datasetObject);

        // Build the Bars
        helpers.each(dataset.data, function (dataPoint, index) {

          // A BarClass contain: a value, index and label, plus the dataset properties for easy access
          datasetObject.bars.push(new this.BarClass({
            index: index,
            value: dataPoint,
            label: data.labels[index],
            datasetLabel: dataset.label,
            strokeColor: dataset.strokeColor,
            fillColor: dataset.fillColor,
            highlightFill:   dataset.highlightFill || dataset.fillColor,
            highlightStroke: dataset.highlightStroke || dataset.strokeColor
          }));
        }, this);

      }, this);

      // Build the scale with the given labels
      this.buildScale(data.labels);

      this.BarClass.prototype.base = this.scale.endPoint;

      // For each bar, add also the width, x and y
      this.eachBars(function (bar, index, datasetIndex) {
        helpers.extend(bar, {
          width: this.scale.calculateBarWidth(this.datasets.length),
          x: this.scale.calculateBarX(this.datasets.length, datasetIndex, index),
          y: this.scale.endPoint
        });

        // Keep an instance of the bar for easy revert
        bar.save();
      }, this);

      this.render();
    },

    /**
     * Update the chart
     */
    update: function update () {
      this.scale.update();

      // Reset any highlight colours before updating.
      helpers.each(this.activeElements, function (activeElement) {
        activeElement.restore(['fillColor', 'strokeColor']);
      });

      // Update save
      this.eachBars(function (bar) {
        bar.save();
      });

      this.render();
    },

    /**
     * Helper utility to loop over the bars
     * @param callback
     */
    eachBars: function eachBars (callback) {
      helpers.each(this.datasets, function (dataset, datasetIndex) {
        helpers.each(dataset.bars, callback, this, datasetIndex);
      }, this);
    },

    /**
     * Get the bars at the DOM even
     * @param {Event} e DOM Event, or jQuery Event
     * @returns {Array}
     */
    getBarsAtEvent: function getBarsAtEvent (e) {
      var barsArray = [],
          eventPosition = helpers.getRelativePosition(e),
          datasetIterator = function (dataset) {
            var bars = dataset.bars[barIndex];
            bars.index = barIndex;
            barsArray.push(bars);
          },
          barIndex;

      for (var datasetIndex = 0; datasetIndex < this.datasets.length; datasetIndex++) {
        for (barIndex = 0; barIndex < this.datasets[datasetIndex].bars.length; barIndex++) {
          if (this.datasets[datasetIndex].bars[barIndex].inRange(eventPosition.x, eventPosition.y)) {
            helpers.each(this.datasets, datasetIterator);
            return barsArray;
          }
        }
      }

      return barsArray;
    },

    /**
     * Add the bars targeted by the event to the activeBars list
     * @param {Event} e DOM Event or jQuery Event
     * @returns {Array}
     */
    activateBars: function activateBars (e) {
      var bars = this.getBarsAtEvent(e);
      this.activeBars = bars;

      // Trigger highlighting active bars
      this.highlightActiveBars();
      return bars;
    },

    /**
     * Add the bars targeted by the event to the activeBars list, or remove it if it was already in it.
     * @param e
     * @returns {Array}
     */
    toggleBars: function toggleBars (e) {
      var bars = this.getBarsAtEvent(e),
          activeBars = this.activeBars;

      helpers.each(bars, function addOrRemoveFromActiveBars (bar) {
        var i;

        if ((i = activeBars.indexOf(bar)) > -1) {
          activeBars.splice(i, 1);
        } else {
          activeBars.splice(0, activeBars.length, bar);
        }
      });

      this.highlightActiveBars();
      return bars;
    },

    /**
     * For each active bar, highlight it
     */
    highlightActiveBars: function highlightActiveBars () {
      helpers.each(this.activeBars, function (activeBar) {
        activeBar.restore(['fillColor', 'strokeColor']);
        activeBar.fillColor = activeBar.highlightFill;
        activeBar.strokeColor = activeBar.highlightStroke;
      });
    },

    /**
     * Build the scale
     * @param labels
     */
    buildScale: function buildScale (labels) {
      var self = this;

      var dataTotal = function () {
        var values = [];
        self.eachBars(function (bar) {
          values.push(bar.value);
        });
        return values;
      };

      var scaleOptions = {
        templateString: this.options.scaleLabel,
        height: this.chart.height,
        width: this.chart.width,
        ctx: this.chart.ctx,
        textColor: this.options.scaleFontColor,
        fontSize: this.options.scaleFontSize,
        fontStyle: this.options.scaleFontStyle,
        fontFamily: this.options.scaleFontFamily,
        valuesCount: labels.length,
        beginAtZero: this.options.scaleBeginAtZero,
        integersOnly: this.options.scaleIntegersOnly,
        calculateYRange: function (currentHeight) {
          var updatedRanges = helpers.calculateScaleRange(
            dataTotal(),
            currentHeight,
            this.fontSize,
            this.beginAtZero,
            this.integersOnly
          );
          helpers.extend(this, updatedRanges);
        },
        xLabels: labels,
        font: helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
        lineWidth: this.options.scaleLineWidth,
        lineColor: this.options.scaleLineColor,
        showHorizontalLines: this.options.scaleShowHorizontalLines,
        showVerticalLines: this.options.scaleShowVerticalLines,
        gridLineWidth: (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
        gridLineColor: (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
        padding: (this.options.showScale) ? 0 : (this.options.barShowStroke) ? this.options.barStrokeWidth : 0,
        showLabels: this.options.scaleShowLabels,
        display: this.options.showScale
      };

      if (this.options.scaleOverride) {
        helpers.extend(scaleOptions, {
          calculateYRange: helpers.noop,
          steps: this.options.scaleSteps,
          stepValue: this.options.scaleStepWidth,
          min: this.options.scaleStartValue,
          max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
        });
      }

      this.scale = new this.ScaleClass(scaleOptions);
    },

    /**
     * Add a new column to the chart
     * @param valuesArray
     * @param label
     */
    addData: function addData (valuesArray, label) {
      //Map the values array for each of the datasets
      helpers.each(valuesArray, function (value, datasetIndex) {
        //Add a new point for each piece of data, passing any required data to draw.
        this.datasets[datasetIndex].bars.push(new this.BarClass({
          value: value,
          label: label,
          x: this.scale.calculateBarX(this.datasets.length, datasetIndex, this.scale.valuesCount + 1),
          y: this.scale.endPoint,
          width: this.scale.calculateBarWidth(this.datasets.length),
          base: this.scale.endPoint,
          strokeColor: this.datasets[datasetIndex].strokeColor,
          fillColor: this.datasets[datasetIndex].fillColor
        }));
      }, this);

      this.scale.addXLabel(label);
      //Then re-render the chart.
      this.update();
    },

    /**
     * Remove the first bar of the chart
     */
    removeData: function () {
      this.scale.removeXLabel();
      //Then re-render the chart.
      helpers.each(this.datasets, function (dataset) {
        dataset.bars.shift();
      }, this);
      this.update();
    },

    /**
     * Recompute the bars
     */
    reflow: function () {
      helpers.extend(this.BarClass.prototype, {
        y: this.scale.endPoint,
        base: this.scale.endPoint
      });
      var newScaleProps = helpers.extend({
        height: this.chart.height,
        width: this.chart.width
      });
      this.scale.update(newScaleProps);
    },

    /**
     * Draw the chart
     * @param ease
     */
    draw: function (ease) {
      var easingDecimal = ease || 1;
      this.clear();

      var ctx = this.chart.ctx;

      this.scale.draw(easingDecimal);

      //Draw all the bars for each dataset
      helpers.each(this.datasets, function (dataset, datasetIndex) {
        helpers.each(dataset.bars, function (bar, index) {
          bar.base = this.scale.endPoint;
          //Transition then draw
          bar.transition({
            x: this.scale.calculateBarX(this.datasets.length, datasetIndex, index),
            y: this.scale.calculateY(bar.value),
            width: this.scale.calculateBarWidth(this.datasets.length)
          }, easingDecimal).draw();
        }, this);

      }, this);
    }
  });
}).call(this);

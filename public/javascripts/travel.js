/***
 * household.js is used to plot and control the charts and map.
 * When the user clicks on a travel zone, the charts will change correspondingly.
 * The webpage layout is coded in './views/household.html' and './public/stylesheets/styleHousehold.css'.
 * If you want to change the position of the charts, it is quite simple and I will explain it in 'household.html'
 */
let travelZoneLayerID = 'TAZ_New';
let tripsDataset; //store ./outputData/output.json
let selectedZone = '101';//store the zone being selected, default zone is '101'
let professionalTravelModeChart = false;
//the selectedDistrictLayer is used to record the selected zone and highlight it with some special color.
let selectedDistrictLayer;
//If trips_1.csv uses other categories (not 'P','C','W'....'S'), the dictionary should be edited correspondingly
let purposeDict = {
    'P':'Personal Business',
    'C':'Escort',
    'W':'Work',
    'L':'Social',
    'H':'Shop',
    'R':'Recreation',
    'Q':'Quick Stop',
    'S':'School'
};
//If trips_1.csv uses other categories (not 'Lo','Med','Hi'), the dictionary should be edited correspondingly
let incomeDict = {
    'Lo':'Low',
    'Med':'Medium',
    'Hi':'High'
};
require([
    "esri/map","dojo/dom-construct", "esri/layers/FeatureLayer",
    "esri/dijit/Popup", "esri/dijit/Legend","esri/symbols/SimpleLineSymbol",
    "esri/InfoTemplate", "esri/symbols/SimpleFillSymbol", "esri/renderers/ClassBreaksRenderer",
    "esri/symbols/SimpleMarkerSymbol","esri/layers/GraphicsLayer","esri/graphic", "esri/Color", "dojo/domReady!"
], function(Map, domConstruct,FeatureLayer, Popup, Legend,SimpleLineSymbol,InfoTemplate,SimpleFillSymbol,ClassBreaksRenderer,SimpleMarkerSymbol,GraphicsLayer,Graphic,Color
) {
    //D3 read json and csv files
    d3.queue().defer(d3.json,'./outputData/output.json')


        .await(loadData);
    //after read the data, call loadData.
    function loadData(error,outputData){
        //store data into global variables

        tripsDataset = outputData;
        //The json object we got from d3.queue() is not perfectly fine for our purpose. So we use convertCSVData function to convert all the json object into desirable format.

        let map = new Map("mapDiv", {
            basemap: "gray-vector",
            center: [-113.4909, 53.5444],
            zoom: 8,
            minZoom:6,
        });
        //travel zone layer
        let travelZoneLayer = new FeatureLayer("https://services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/newestTAZ/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["*"],
            //you could try to uncomment the line below. Clicking on map, it will show an infowindow.
            // infoTemplate:new InfoTemplate("Attributes", "Travel Zone:${TAZ_New}")
        });
        //LRT layer
        let lrtFeatureLayer = new FeatureLayer("https://services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/LRT/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["*"],
        });
        //edmonton hydro layer
        let hydroLayer = new FeatureLayer("https://services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/edmontonHydro/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["*"],
        });
        //when map is loading
        map.on('load',function(){
            map.addLayer(travelZoneLayer);
            map.addLayer(lrtFeatureLayer);
            map.addLayer(hydroLayer);
            drawChart(selectedZone);//draw all the charts based on the default zone
        });

        //render color on the travel zone layer
        let symbol = new SimpleFillSymbol();
        let renderer = new ClassBreaksRenderer(symbol, function(feature){
            return 1;
        });
        renderer.addBreak(0, 10, new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([65,105,225,0.5]),1)).setColor(new Color([255, 255, 255,0.5])));
        travelZoneLayer.setRenderer(renderer);
        travelZoneLayer.redraw();

        //add onclick event of district layer
        travelZoneLayer.on('click',function(e){
            //get clicked zone's ID
            selectedZone = e.graphic.attributes[travelZoneLayerID];
            // Draw the chart and set the chart values
            drawChart(selectedZone);
            redrawHighlightDistrict(e);
            map.addLayer(selectedDistrictLayer);
        });


        //initialize mode chart
        let modeChart = Highcharts.chart('mode', {
            chart: {
                inverted: false,
                polar: true
            },
            title: {
                text: 'Travel Mode',
            },
            xAxis: {
                categories: []
            },
            series: [{
                name:'Total',
                type: 'column',
                colorByPoint: true,
                data: [],
                showInLegend: false,
                dataLabels: {
                    enabled: true,
                    format: '{point.y}', // one decimal
                    y: 0, // 10 pixels down from the top
                    style: {
                        fontSize: '8px',
                        textOverflow: 'clip'
                    }
                }
            }],
            legend: {
                enabled: true
            },
            credits: {
                enabled: false
            }
        });



        //initialize Trips By Purpose chart
        let tripsByPurposeChart = Highcharts.chart('tripsByPurpose', {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: 0,
                plotShadow: false,
                events: {
                    drilldown: function(e) {
                        tripsByPurposeChart.setTitle({ text: e.point.name });
                    },
                    drillup: function(e) {
                        tripsByPurposeChart.setTitle({ text: "Trips By Purpose" });
                    }
                },

            },
            yAxis:{
                text:''
            },
            title: {
                text: 'Trips By Purpose',
                y: 40
            },
            plotOptions: {
                pie: {
                    dataLabels: {
                        enabled: true,
                        style: {
                            fontWeight: 'bold',
                            color: 'white',
                            textOverflow: 'clip'
                        }
                    },
                    startAngle: -90,
                    endAngle: 90,
                    center: ['50%', '75%'],
                    size: '60%',
                }
            },
            series: [{
                type: 'pie',
                name: 'Trips Amount',
                data: [],

            }],
            credits: {
                enabled: false
            },
            drilldown:{
                series: []
            }
        });
        //if the user click on the 'Change View' button, change the chart's attribute
        $('#changeView').on('click',function(e){
            if(professionalTravelModeChart===false){
                professionalTravelModeChart=true;
                updateTravelModeChart(selectedZone);
            }
            else{
                professionalTravelModeChart=false;
                updateTravelModeChart(selectedZone);
            }
        });
        function redrawHighlightDistrict(e){
            //if there is a highlighted polygon, delete it
            if(selectedDistrictLayer){
                map.removeLayer(selectedDistrictLayer);
            }
            //redraw the highlighted polygon based on current selection
            selectedDistrictLayer = new GraphicsLayer({ id: "selectedDistrictLayer" });
            let highlightSymbol = new SimpleFillSymbol(
                SimpleFillSymbol.STYLE_SOLID,
                new SimpleLineSymbol(
                    SimpleLineSymbol.STYLE_SOLID,
                    new Color([255,0,0,0.5]), 2
                ),
                new Color([255,0,0,0.5])
            );
            let graphic = new Graphic(e.graphic.geometry, highlightSymbol);
            selectedDistrictLayer.add(graphic);
        }

        //update charts based on current selected zone
        //This function will be called whenever the user clicks on a new district.
        function drawChart(selectedZone){

            //update travel mode chart
            updateTravelModeChart(selectedZone);

            //update trips by purpose chart data
            updateTripsChart(selectedZone);
            updateBulletChart();
        }
        function updateTravelModeChart(selectedZone){
            if(professionalTravelModeChart === false){
                let modeArray= [];
                for(let i in tripsDataset[selectedZone]['Mode']){
                    modeArray.push([i,tripsDataset[selectedZone]['Mode'][i]]);}
                modeChart.series[0].setData(getKeysValuesOfTripsObject(modeArray)[1]);
                modeChart.xAxis[0].setCategories(getKeysValuesOfTripsObject(modeArray)[0]);
            }
            else{
                /**Start of Special Mode Chart*/
                let selfDefinedMode = {'Bike':0,'Driver':0,'Transit':0,'School Bus':0,'Passenger':0,'Walk':0};
                for(let i in tripsDataset[selectedZone]['Mode']){
                    if(i==='Bike'){
                        selfDefinedMode['Bike']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='SOV'){
                        selfDefinedMode['Driver']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='WAT'){
                        selfDefinedMode['Transit']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='PNR'){
                        selfDefinedMode['Transit']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='SB'){
                        selfDefinedMode['School Bus']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='HOV2'){
                        selfDefinedMode['Driver']+=tripsDataset[selectedZone]['Mode'][i]/2
                        selfDefinedMode['Passenger']+=tripsDataset[selectedZone]['Mode'][i]/2
                    }
                    else if(i==='HOV3'){
                        selfDefinedMode['Driver']+=tripsDataset[selectedZone]['Mode'][i]/3.2
                        selfDefinedMode['Passenger']+=tripsDataset[selectedZone]['Mode'][i]*2.2/3.2
                    }
                    else if(i==='Walk'){
                        selfDefinedMode['Walk']+=tripsDataset[selectedZone]['Mode'][i]
                    }
                    else if(i==='KNR'){
                        selfDefinedMode['Transit']+=tripsDataset[selectedZone]['Mode'][i]
                    }

                }
                let modeArray= [];
                for(let i in selfDefinedMode){
                    modeArray.push([i,selfDefinedMode[i]]);}
                modeChart.series[0].setData(getKeysValuesOfTripsObject(modeArray)[1]);
                modeChart.xAxis[0].setCategories(getKeysValuesOfTripsObject(modeArray)[0]);
                /**End of Special Mode Chart*/
            }
        }

        function updateTripsChart(selectZone){
            let tripsByPurposeArray = [];
            for(let i in tripsDataset[selectedZone]['TourPurp']){
                tripsByPurposeArray.push({'name':purposeDict[i],'y':tripsDataset[selectedZone]['TourPurp'][i],'drilldown':i})
            }
            tripsByPurposeChart.xAxis[0].setCategories(getCategoriesOfDistByPurp(tripsDataset[selectedZone]['TourDistByPurp']));
            //update drilldown data of trips by purpose chart
            tripsByPurposeChart.options.drilldown.series = generateDrilldownSeries(tripsDataset[selectedZone]['TourDistByPurp']);
            tripsByPurposeChart.series[0].setData(tripsByPurposeArray);
        }
    }
});

/***
 all the bullets chart is able to drill down
 However, I didn't use the highchart's drill down function, since it is not very suitable to this case.
 I put four bullets chart into a single DIV, and I need each bullet chart being able to change itself to show a detailed bar/pie chart.
 I wrote my own drill down method.
 ***/
function hideCharts(){
    $('.subchart').hide();
}
function showCharts(){
    $('.subchart').show();
}

function updateBulletChart(){
    //set highcharts' feature to draw bullet chart
    Highcharts.setOptions({
        chart: {
            inverted: true,
            marginLeft: 135,
            type: 'bullet'
        },
        title: {
            text: null
        },
        legend: {
            enabled: false
        },
        yAxis: {
            gridLineWidth: 0
        },
        plotOptions: {
            series: {
                borderWidth: 0,
                color: '#000',
            }
        },
        credits: {
            enabled: false
        },
        exporting: {
            enabled: false
        }
    });
    //show all four bullet charts
    $('#avgDist').show();
    $('#avgGHG').show();

    $('#avgDist').height('35%');
    $('#avgGHG').height('35%');


    //calculate total distance
    let totalDist = 0;
    for(let k in tripsDataset[selectedZone]['Dist']){
        totalDist += tripsDataset[selectedZone]['Dist'][k]
    }
    //calculate total numbers of trips
    let totalAmount = 0;
    for(let k in tripsDataset[selectedZone]['TourPurp']) {
        totalAmount += tripsDataset[selectedZone]['TourPurp'][k]
    }
    //draw Average Travel Distance bullet chart
    let distChart = Highcharts.chart('avgDist', {
        chart: {
            marginTop: 50
        },
        yAxis: {
            plotBands: [{
                from: 0,
                to: 30,
                color: '#999'
            }, {
                from: 30,
                to: 1000000000,
                color: '#999'
            }],
            labels: {
                format: '{value}'
            },
            title: null
        },
        xAxis: {
            categories: ['Average Travel  <br/>Distance (km)'],
            labels: {
                style: {
                    color: '#212d7a',
                    fontWeight: 'bold',
                    textDecoration:'underline'
                }
            }
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.y:.2f}</b>'
        },
        series: [{
            name:'Distance',
            data: [{
                y: totalDist/totalAmount,
                target: 30,
            }]
        }],
    });
    //add click event to the label
    distChart.xAxis[0].labelGroup.element.childNodes.forEach(function(label)
    {
        label.style.cursor = "pointer";
        //when the user clicks on the distChart's labels, the following function will be called.
        label.onclick = function() {
            // show average distance chart and hide all the others
            $('#avgDist').show();
            $('#avgDist').height('100%');
            $('#totalEmp').hide();
            $('#avgGHG').hide();
            $('#totalPop').hide();
            let distByPurpose = [];
            for(let purp in tripsDataset[selectedZone]['TourPurp']){
                distByPurpose.push([purposeDict[purp],tripsDataset[selectedZone]['Dist'][purp]/tripsDataset[selectedZone]['TourPurp'][purp]])
            }
            //update the avgDist chart to a dist by purpose
            let drillDownDistChart = Highcharts.chart('avgDist', {
                chart: {
                    type: 'column'
                },
                title: {
                    text: 'Average Distance By Purpose'
                },
                xAxis: {
                    type: 'category',
                    labels: {
                        rotation: -0,
                        style: {
                            fontSize: '13px',
                            fontFamily: 'Verdana, sans-serif',
                            textOverflow: 'clip'

                        }
                    }
                },
                yAxis: {
                    min: 0,
                    title: {
                        text: ' Travel distance (km)'
                    }
                },
                tooltip: {
                    headerFormat: '<span style="font-size:11px">{point.name}</span><br>',
                    pointFormat: '<span style="color:{point.color}">Amount</span>: <b>{point.y:0.2f}</b><br/>'
                },
                legend: {
                    enabled: false
                },
                series: [{
                    type:'column',
                    name: 'Population',
                    data: distByPurpose,
                    dataLabels: {
                        enabled: true,
                        format: '{point.y:.1f}', // one decimal
                        y: 0, // 10 pixels down from the top
                        style: {
                            fontSize: '8px',
                            textOverflow: 'clip'
                        }
                    }
                }]
            });
            //<rect fill="#f7f7f7" class='highcharts-button-box' x='0.5' y='0.5' width='44' height='34' rx='2' ry='2' stroke='#cccccc' stroke-width="1"></rect>
            //add click label event to the dist by purpose chart
            //if the user clicks on this drillDownDistChart's labels, the updateBulletChart function will be called again.
            //it is a self-perpetuate feature
            $('#avgDist').append("<button class='back' id='backButton'>Back</button>");
            $('#backButton').on('click',function(e){
                $("#backButton").remove();
                updateBulletChart()
            })

        }
    });
    //draw average green house gas emission chart
    let ghgChart = Highcharts.chart('avgGHG', {
        chart: {
            marginTop: 50
        },
        xAxis: {
            categories: ['Average GHG (kg)'],
            labels: {
                style: {
                    color: '#212d7a',
                    fontWeight: 'bold',
                    textDecoration:'underline'
                }
            }
        },
        yAxis: {
            plotBands: [{
                from: 0,
                to: 10,
                color: '#999'
            }, {
                from: 10,
                to: 10000000,
                color: '#999'
            }],
            title: null
        },
        series: [{
            name:'Gas Weight',
            data: [{
                y: totalDist/totalAmount*0.327,
                target: 10,
            }
            ]
        }],
        tooltip: {
            pointFormat: '{series.name}: <b>{point.y:.2f}</b>'
        },
    });


    //add drilldown event to the label of the chart
    ghgChart.xAxis[0].labelGroup.element.childNodes.forEach(function(label)
    {   console.log(1111)
        label.style.cursor = "pointer";
        label.onclick = function() {
            $('#avgGHG').show();
            $('#avgGHG').height('100%');
            $('#avgDist').hide();
            $('#totalEmp').hide();
            $('#totalPop').hide();
            let ghgByPurpose = [];
            for(let purp in tripsDataset[selectedZone]['TourPurp']){
                ghgByPurpose.push([purposeDict[purp],tripsDataset[selectedZone]['Dist'][purp]*0.327/tripsDataset[selectedZone]['Person#'][purp]])
            }
            let drillDownGHGChart = Highcharts.chart('avgGHG', {
                chart: {
                    type: 'column'
                },
                title: {
                    text: 'Average Greenhouse Gas By Purpose'
                },
                xAxis: {
                    type: 'category',
                    labels: {
                        rotation: -0,
                        style: {
                            fontSize: '13px',
                            fontFamily: 'Verdana, sans-serif',
                            textOverflow: 'clip'
                        }
                    }
                },
                yAxis: {
                    min: 0,
                    title: {
                        text: ' GHG emission(kg)'
                    }
                },
                tooltip: {
                    headerFormat: '<span style="font-size:11px">{point.name}</span><br>',
                    pointFormat: '<span style="color:{point.color}">Amount</span>: <b>{point.y:0.2f}</b><br/>'
                },
                legend: {
                    enabled: false
                },
                series: [{
                    data: ghgByPurpose,
                    dataLabels: {
                        enabled: true,
                        format: '{point.y:.1f}', // one decimal
                        y: 0, // 10 pixels down from the top
                        style: {
                            fontSize: '8px',
                            textOverflow: 'clip'
                        }
                    }
                }]
            });
            $('#avgGHG').append("<button class='back' id='backButton'>Back</button>");
            $('#backButton').on('click',function(e){
                $("#backButton").remove();
                updateBulletChart()
            })


            // //add back to original event to the chart's label
            // drillDownGHGChart.xAxis[0].labelGroup.element.childNodes.forEach(function(label)
            // {
            //     label.style.cursor = "pointer";
            //     label.onclick = function() {updateBulletChart()}
            // })
        }
    });




}
//seperate a Trip object into a list of values and a list of keys
function getKeysValuesOfTripsObject(obj){
    let keys = [];
    let values = [];
    for(let k in obj){
        keys.push(obj[k][0]);
        values.push(Number(obj[k][1]));
    }
    return [keys,values];
}
//seperate an common object into a list of values and a list of keys
function getKeysValuesOfObject(obj){
    let keys = [];
    let values = [];
    for(let k in obj){
        keys.push(k);
        values.push(Number(obj[k]))
    }
    return [keys,values];
}
//convert csv data into desirable json format
function convertCSVData(popEmpDataset) {
    let TAZTitle = 'TAZ1669';
    let tmpData = {};
    for(let k in popEmpDataset){
        let result = {};
        for(let title in popEmpDataset[k]){
            if(title!== TAZTitle){
                result[title] = popEmpDataset[k][title]
            }
        }
        tmpData[popEmpDataset[k][TAZTitle]] = result;
    }
    return tmpData
}

//generate drilldown series of 'Trips by purpose' chart
function generateDrilldownSeries(distPurpArray){
    let result = [];
    for(let k in distPurpArray){
        distArray = [];
        for(let distK in distPurpArray[k]){
            distArray.push({'name':distK,'y':distPurpArray[k][distK]})
        }
        result.push({
            id:k,
            type:'line',
            name: 'Amount of Trips',
            data:distArray
        })
    }
    return result
}
//get xAxis categories
function getCategoriesOfDistByPurp(distPurpArray){
    let result = [];
    for(let k in distPurpArray){
        for(let distK in distPurpArray[k]){
            result.push(distK+'km')
        }
        return result
    }
}



$('#tour').on('click',function(e){
    let intro1 = introJs();
    intro1.setOptions({
        tooltipPosition : 'bottom',
        steps: [
            {
                element: '#title',
                intro: 'Welcome to Travel Zone Dashboard! You could get trip and household information about each travel zone.',
                position: 'top'
            },
            {
                element: '#mapDiv',
                intro: 'Please click on a travel zone. If there is no data of that zone, please try another zone.',
                position: 'top'
            },
            {
                element: '#tripsByPurpose',
                intro: 'Now, you could click on a blue label to observe some details.',
                position: 'top'
            },
            {
                element: '#changeMode',
                intro: 'Travel mode could switch between two set of categories. The data set is the same.',
                position: 'top'
            },
            {
                element: '#avgDist',
                intro: 'Again, try to click on a blue label!',
                position: 'top'
            },
            {
                element: '#travelPage',
                intro: 'Click this button to find Household Info for your traffic zone!',
                position: 'top'
            }

        ]
    });
    intro1.start();
});
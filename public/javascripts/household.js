/***
 * household.js is used to plot and control the charts and map.
 * When the user clicks on a travel zone, the charts will change correspondingly.
 * The webpage layout is coded in './views/household.html' and './public/stylesheets/styleHousehold.css'.
 * If you want to change the position of the charts, it is quite simple and I will explain it in 'household.html'
 */

let travelZoneLayerID = 'TAZ_New';
let travelZoneShapeAreaID = 'Shape__Area'; //I think its unit is m^2
let tripsDataset; //store ./outputData/output.json
let popEmpDataset;//store ./data/RTM3_Emp_2015.csv
let populationBreakdown;//store ./data/Population_2015_RTM3.csv
let dwellingTypeDataset; //store ./data/DwellingType_2015_RTM3.csv
let selectedZone = '101';//store the zone being selected, default zone is '101'
let selectedZoneArea = 2233525.0625;//store the zone being selected, default zone is '101' and area is the area of '101'
let occupationOrIndustry = false; //false: occupation, true: industry
//the selectedDistrictLayer is used to record the selected zone and highlight it with some special color.
let selectedDistrictLayer;
let empOccupationDataset;
let empIndustryDataset;

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
              .defer(d3.csv,'./data/RTM3_Emp_Pop_2015.csv')
              .defer(d3.csv,'./data/Population_2015_RTM3.csv')
              .defer(d3.csv,'./data/DwellingType_2015_RTM3.csv')
              .defer(d3.csv,'./data/Emp_Industry.csv')
              .defer(d3.csv,'./data/Emp_Occupation.csv')
              .await(loadData);
    //after read the data, call loadData.
    function loadData(error,outputData,popEmpData,popBreak,dwellingData,empIndustryData,empOccupationData){
        //store data into global variables
        tripsDataset = outputData;
        //The json object we got from d3.queue() is not perfectly fine for our purpose. So we use convertCSVData function to convert all the json object into desirable format.
        popEmpDataset = convertCSVData(popEmpData);
        populationBreakdown = convertCSVData(popBreak);
        dwellingTypeDataset = convertCSVData(dwellingData);
        empOccupationDataset = convertCSVData(empOccupationData);
        empIndustryDataset = convertCSVData(empIndustryData);
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
            drawChart(selectedZone,selectedZoneArea);//draw all the charts based on the default zone
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


            selectedZoneArea = Number(e.graphic.attributes[travelZoneShapeAreaID]);
            // Draw the chart and set the chart values
            drawChart(selectedZone,selectedZoneArea);
            redrawHighlightDistrict(e);
            map.addLayer(selectedDistrictLayer);
        });
        let ageDistributionChart =Highcharts.chart('ageDistribution', {
            chart: {
                marginLeft: 3,
                type: 'variablepie',
            },
            title: {
                text: 'Age Distribution'
            },
            tooltip: {
                headerFormat: '',
                pointFormat: '<span style="color:{point.color}">\u25CF</span> <b> {point.name}</b><br/>' +
                    'Age: <b>{point.name}</b><br/>' +
                    'Population: <b>{point.z}</b><br/>'
            },
            plotOptions: {
                variablepie: {
                    size:'60%',
                    allowPointSelect: true,
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                        style: {
                            color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                        },
                        textOverflow: 'clip'

                    },

                }
            },
            //Hard coding part. If your data structure change, you will have to change this part of code
            series: [{
                innerSize: '20%',
                data: {}
            }]
        });

        //initialize mode chart
        let empByOccupationIndustryChart = Highcharts.chart('empByOccupationOrIndustry', {
            chart: {
                polar: true,
                margin: [75, 75, 75, 75],
            },
            title: {
                text: 'Employment By Occupation',
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
                enabled: false
            },
            credits: {
                enabled: false
            },

        });
        //initialize dwelling chart
        let dwellingChart = Highcharts.chart('dwelling', {
                chart: {
                    polar: true,
                    type: 'line'
                },
                title: {
                    text: 'Dwelling Type',

                },
                pane: {
                    size: '80%'
                },
                xAxis: {
                    min: 0,
                    categories: [],
                    tickmarkPlacement: 'on',
                    lineWidth: 0,
                },
                yAxis: {
                    gridLineInterpolation: 'polygon',
                    lineWidth: 0,
                    min: 0,

                },
                tooltip: {
                    shared: true,
                },

                series: [{
                    name: "Number of Dwelling Units",
                    data: [],
                    pointPlacement: 'on',
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
                credits: {
                    enabled: false
                }
        });
        //initialize autoOwnership chart
        let autoOwnershipChart = Highcharts.chart('autoOwnership', {
            chart: {
                type: 'column'
            },
            title: {
                text: 'Auto Ownership'
            },
            xAxis: {
                categories: '',
                title: {
                    text: "Number of Cars Per Household"
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Total',
                },
                labels: {
                    overflow: 'justify'
                }
            },
            tooltip: {
                shared: true,
            },
            legend: {
                layout: 'vertical',
                align: 'right',
                verticalAlign: 'top',
                x: -40,
                y: 80,
                floating: true,
                borderWidth: 1,
                backgroundColor: ((Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'),
                shadow: true
            },
            credits: {
                enabled: false
            },
            series: [{
                name:'Total',
                type: 'column',
                data:  '',
                showInLegend: false
            }]
        });



        //initialize income chart
        let incomeChart = Highcharts.chart('income', {
            chart: {
                type: 'column'
            },
            title: {
                text: 'Income Group'
            },
            xAxis: {
                type: 'category'
            },
            legend: {
                enabled: false
            },
            plotOptions: {
                column: {
                    pointPadding: 0.2,
                    borderWidth: 0
                },
                series: {
                    borderWidth: 0,
                    dataLabels: {
                        enabled: true,
                        format: '{point.y:.1f}%'
                    }
                }
            },
            tooltip: {

                pointFormat: ' <b>{point.y:0.2f}%</b> of total<br/>'
            },
            series: [
                {
                    type: 'column',
                    colorByPoint: true,
                    data: []
                }
            ],
            credits: {
                enabled: false
            }
        });

        //initialize Household chart
        let HHChart = Highcharts.chart('HHSize', {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false,
                type: 'bar'
            },
            title: {
                text: 'Household Size'
            },
            tooltip: {
                headerFormat: '<span style="font-size:11px">{point.name}</span><br>',
                pointFormat: '<span style="color:{point.color}">Total</span>: <b>{point.y}</b><br/>'
            },
            yAxis: {
                title: {
                    text:'Total'
                }
            },
            legend: {
                enabled: false
            },
            series: [{
                colorByPoint: true,
                data:[]
            }],
            credits: {
                enabled: false
            }
        });
        Highcharts.setOptions({
            lang: {
                drillUpText: 'Back'
            }
        });


        //if the user click on the 'Change View' button, change the chart's attribute
        $('#changeView').on('click',function(e){
            if(occupationOrIndustry===false){
                occupationOrIndustry=true;
                updateEmpByOccupationIndustryChart(selectedZone);
            }
            else{
                occupationOrIndustry=false;
                updateEmpByOccupationIndustryChart(selectedZone);
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
        function drawChart(selectedZone,selectedZoneArea){

            //automatically click drilldown back button so that the tripsByPurpose chart will always show a pie chart when the user changes the selection
            $('.highcharts-drillup-button').click();
            //update dwelling chart data
            updateDwellingChart(selectedZone);
            //update autoOwnerShip chart
            updateAutoChart(selectedZone);

            //update income chart data
            updateIncomeChart(selectedZone);
            //update HHSize chart data
            updateHHChart(selectedZone);

            //update age distribution chart data
            updateAgeDistributionChart(selectedZone);
            //update empByOccupationIndustryChart data
            updateEmpByOccupationIndustryChart(selectedZone);
            //update job_pop_info chart
            updateJobPopInfoChart(selectedZone,selectedZoneArea);
        }
        function updateJobPopInfoChart(selectedZone,selectedZoneArea){
            let numOfJobs = Number(popEmpDataset[selectedZone]['Jobs']).toFixed(0);
            let numOfPopulation = Number(popEmpDataset[selectedZone]['Population']).toFixed(0);
            $('#jobVSpop').html((numOfJobs/numOfPopulation).toFixed(2));
            $('#popPerZone').html(numOfPopulation);
            $('#popDensity').html((numOfPopulation/selectedZoneArea).toFixed(5));
            $('#empPerZone').html(numOfJobs);
            $('#empDensity').html((numOfJobs/selectedZoneArea).toFixed(5))
        }
        function updateDwellingChart(selectedZone){
            dwellingChart.series[0].setData(getKeysValuesOfObject(dwellingTypeDataset[selectedZone])[1]);
            dwellingChart.xAxis[0].setCategories(getKeysValuesOfObject(dwellingTypeDataset[selectedZone])[0]);
            if(dwellingChart.yAxis[0].getExtremes().dataMax === 0){
                dwellingChart.yAxis[0].setExtremes(0,10);
            }
            else{
                dwellingChart.yAxis[0].setExtremes();
            }
        }

        function updateIncomeChart(selectedZone){
            let incomeSum=0;
            for (let i in tripsDataset[selectedZone]['IncGrp']){
                incomeSum += tripsDataset[selectedZone]['IncGrp'][i];
            }
            let incomeArray = [];
            for(let i in tripsDataset[selectedZone]['IncGrp']){
                incomeArray.push([incomeDict[i],tripsDataset[selectedZone]['IncGrp'][i]*100/incomeSum]);
            }
            incomeChart.series[0].setData(incomeArray);
        }
        function updateHHChart(selectZone){
            let HHSizeArray = [];
            let HHlargerThanFive = 0;
            for(let i in tripsDataset[selectedZone]['HHSize']){
                //combine the value of 5+ condition
                if(Number(i)>=5){
                    HHlargerThanFive+=tripsDataset[selectedZone]['HHSize'][i];
                }
                else{
                    HHSizeArray.push([i,tripsDataset[selectedZone]['HHSize'][i]])
                }
            }
            HHSizeArray.push(['5+',HHlargerThanFive]);//add 5+ data to the autoArray
            HHChart.series[0].setData(HHSizeArray);
            HHChart.xAxis[0].setCategories(getKeysValuesOfTripsObject(HHSizeArray)[0])
        }
        function updateAutoChart(selectedZone){
            let autoArray= [];
            let largerThanFive = 0;
            if(typeof(tripsDataset[selectedZone])=== 'undefined'){
                alert('There is no trip data of your selected zone!');
                //hide all charts
                hideCharts();
                return
            }
            else{
                //show all charts
                showCharts();
            }
            //if the household size is larger than 5, then combine them to a '5+' column
            for(let i in tripsDataset[selectedZone]['Own']){
                //combine the value of 5+ condition
                if(i>=5){
                    largerThanFive+=tripsDataset[selectedZone]['Own'][i];
                }
                else{
                    autoArray.push([i,tripsDataset[selectedZone]['Own'][i]]);
                }
            }
            autoArray.push(['5+',largerThanFive]);//add 5+ data to the autoArray
            autoOwnershipChart.series[0].setData(getKeysValuesOfTripsObject(autoArray)[1]);
            autoOwnershipChart.xAxis[0].setCategories(getKeysValuesOfTripsObject(autoArray)[0]);
        }
        function updateAgeDistributionChart(selectedZone){
            let ageDistributionArray = [{
                name: '0~4',
                y: Number(populationBreakdown[selectedZone]['age04']),
                z: 4
            }, {
                name: '5~9',
                y: Number(populationBreakdown[selectedZone]['age59']),
                z: 9
            }, {
                name: '10~14',
                y:  Number(populationBreakdown[selectedZone]['age1014']),
                z: 14
            }, {
                name: '15~19',
                y: Number(populationBreakdown[selectedZone]['age1519']),
                z: 19
            }, {
                name: '20~24',
                y: Number(populationBreakdown[selectedZone]['age2024']),
                z: 24
            }, {
                name: '25~34',
                y: Number(populationBreakdown[selectedZone]['age2534']),
                z: 34
            }, {
                name: '35~44',
                y: Number(populationBreakdown[selectedZone]['age3544']),
                z: 44
            },
                {
                    name: '45~54',
                    y: Number(populationBreakdown[selectedZone]['age4554']),
                    z: 54
                },
                {
                    name: '55~64',
                    y: Number(populationBreakdown[selectedZone]['age5564']),
                    z:64
                },
                {
                    name: '65~74',
                    y: Number(populationBreakdown[selectedZone]['age6574']),
                    z: 74
                },
                {   color:'red',
                    name: '75+',
                    y: Number(populationBreakdown[selectedZone]['age75a']),
                    z:84
                }];

            ageDistributionChart.series[0].setData(ageDistributionArray);

        }
        function updateEmpByOccupationIndustryChart(selectedZone){
            if(occupationOrIndustry === false){

                empByOccupationIndustryChart.series[0].setData(getKeysValuesOfObject(empOccupationDataset[selectedZone])[1]);
                empByOccupationIndustryChart.xAxis[0].setCategories(getKeysValuesOfObject(empOccupationDataset[selectedZone])[0]);
            }
            else{

                empByOccupationIndustryChart.series[0].setData(getKeysValuesOfObject(empIndustryDataset[selectedZone])[1]);
                empByOccupationIndustryChart.xAxis[0].setCategories(getKeysValuesOfObject(empIndustryDataset[selectedZone])[0]);
            }


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

// function updateBulletChart(){
//     //set highcharts' feature to draw bullet chart
//     Highcharts.setOptions({
//         chart: {
//             inverted: true,
//             marginLeft: 135,
//             type: 'bullet'
//         },
//         title: {
//             text: null
//         },
//         legend: {
//             enabled: false
//         },
//         yAxis: {
//             gridLineWidth: 0
//         },
//         plotOptions: {
//             series: {
//                 borderWidth: 0,
//                 color: '#000',
//             }
//         },
//         credits: {
//             enabled: false
//         },
//         exporting: {
//             enabled: false
//         }
//     });
//     //show all four bullet charts
//
//     $('#totalEmp').show();
//     $('#totalPop').show();
//
//
//     $('#totalEmp').height('35%');
//     $('#totalPop').height('35%');
//     //calculate total distance
//     let totalDist = 0;
//     for(let k in tripsDataset[selectedZone]['Dist']){
//         totalDist += tripsDataset[selectedZone]['Dist'][k]
//     }
//     //calculate total numbers of trips
//     let totalAmount = 0;
//     for(let k in tripsDataset[selectedZone]['TourPurp']) {
//         totalAmount += tripsDataset[selectedZone]['TourPurp'][k]
//     }
//     //draw total employment bullet chart
//     let totalEmp = Highcharts.chart('totalEmp', {
//         chart: {
//             marginTop: 50
//         },
//         xAxis: {
//             categories: ['Total Jobs'],
//             labels: {
//                 style: {
//                     color: '#212d7a',
//                     fontWeight: 'bold',
//                     textDecoration:'underline'
//                 }
//             }
//         },
//         yAxis: {
//             plotBands: [{
//                 from: 0,
//                 to: 1000000000000000,
//                 color: '#999'
//             }],
//             title: null
//         },
//         series: [{
//             data: [{
//                 y: Number(popEmpDataset[selectedZone]['Jobs']),
//                 target: 0,
//             }]
//         }],
//         tooltip: {
//             pointFormat: '<b>{point.y}</b> (with target at {point.target})'
//         }
//     });
//
//
//     //add drill down event
//     totalEmp.xAxis[0].labelGroup.element.childNodes.forEach(function(label)
//     {
//         label.style.cursor = "pointer";
//         label.onclick = function() {
//             $('#totalEmp').show();
//             $('#totalEmp').height('100%');
//
//             $('#totalPop').hide();
//             let ghgByPurpose = [];
//             for(let purp in tripsDataset[selectedZone]['TourPurp']){
//                 ghgByPurpose.push([purposeDict[purp],tripsDataset[selectedZone]['Dist'][purp]*0.327/tripsDataset[selectedZone]['Person#'][purp]])
//             }
//             let drillDownGHGChart = Highcharts.chart('totalEmp', {
//                 chart: {
//                     type: 'column'
//                 },
//                 title: {
//                     text: 'I do not know what to draw'
//                 },
//                 xAxis: {
//                     type: 'category',
//                     labels: {
//                         rotation: -0,
//                         style: {
//                             fontSize: '13px',
//                             fontFamily: 'Verdana, sans-serif',
//                             textOverflow: 'clip'
//                         }
//                     }
//                 },
//                 yAxis: {
//                     min: 0,
//                     title: {
//                         text: ' GHG emission(kg)'
//                     }
//                 },
//                 tooltip: {
//                     headerFormat: '<span style="font-size:11px">{point.name}</span><br>',
//                     pointFormat: '<span style="color:{point.color}">Amount</span>: <b>{point.y:0.2f}</b><br/>'
//                 },
//                 legend: {
//                     enabled: false
//                 },
//                 series: [{
//                     data: ghgByPurpose,
//                     dataLabels: {
//                         enabled: true,
//                         format: '{point.y:.1f}', // one decimal
//                         y: 0, // 10 pixels down from the top
//                         style: {
//                             fontSize: '8px',
//                             textOverflow: 'clip'
//                         }
//                     }
//                 }]
//             });
//             //add back event
//             $('#totalEmp').append("<button class='back' id='backButton'>Back</button>");
//             $('#backButton').on('click',function(e){
//                 $("#backButton").remove();
//                 updateBulletChart()
//             })
//
//         }
//     });
//     //calculate population
//     let popOfSelectedZone = 0;
//     for(let i in populationBreakdown[selectedZone]){
//         popOfSelectedZone+=Number(populationBreakdown[selectedZone][i])
//     }
//     //draw total population bullet chart
//     let totalPop = Highcharts.chart('totalPop', {
//         chart: {
//             marginTop: 50,
//         },
//         xAxis: {
//             categories: ['Total Population'],
//             labels: {
//                 style: {
//                     color: '#212d7a',
//                     fontWeight: 'bold',
//                     textDecoration:'underline'
//                 }
//             }
//         },
//         yAxis: {
//             plotBands: [ {
//                 from: 0,
//                 to: 100000000000000,
//                 color: '#999'
//             }],
//             title: null
//         },
//         series: [{
//             data: [{
//                 y:popOfSelectedZone ,
//                 target: 0,
//             }]
//         }],
//         tooltip: {
//             pointFormat: '<b>{point.y}</b> (with target at {point.target})'
//         }
//     });
//     //add drill down event
//
//
//     totalPop.xAxis[0].labelGroup.element.childNodes.forEach(function(label)
//     {
//         label.style.cursor = "pointer";
//         label.onclick = function() {
//             $('#totalPop').show();
//             $('#totalPop').height('100%');
//
//             $('#totalEmp').hide();
//
//
//             $('#totalPop').append("<button class='back' id='backButton'>Back</button>");
//             $('#backButton').on('click',function(e){
//                 $("#backButton").remove();
//                 updateBulletChart()
//             });
//         }
//     });
// }
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
        ]
    });
    intro1.start();
});
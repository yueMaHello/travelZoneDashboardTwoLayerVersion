//this is a automatic UI test, actually, just for fun
//You can run it through another CMD (why another? since you have to use a CMD to keep the app running and test it through another termianl)
// type: "testcafe-live chrome household.js"
//it will open a browser and run itself
//what you need to do is to watch a movie....
import { Selector } from 'testcafe';

fixture `Getting Started`
    .page `http://162.106.202.155:3033`;

test('My first test', async t => {
  await t
        .wait(9000)
       .click('#map',{offsetX:100,offsetY:200})
       .click('#map',{offsetX:200,offsetY:300})
       .click('#map',{offsetX:500,offsetY:300})
       .wait(3000)
       .click('.switch')
       .wait(3000)
       .click('.switch')
       .hover('#map',{offsetX:100,offsetY:200})
       .wait(2000)
       .hover('#map',{offsetX:400,offsetY:200})
       .wait(2000)
       .hover('#map',{offsetX:222,offsetY:200})
       .wait(2000)
       .hover('#map',{offsetX:100,offsetY:500})

});

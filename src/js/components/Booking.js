/* eslint-disable no-undef */
/*eslint linebreak-style: ["error", "windows"]*/
import AmountWidget from './AmountWidget.js';
import {select, templates, settings, classNames} from '../settings.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';
import utils from '../utils.js';

class Booking{
  constructor(widgetContainer){
    const thisBooking = this;

    thisBooking.render(widgetContainer);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.selectTable();

    thisBooking.rangeBackg();
  }

  getData(){
    const thisBooking = this;

    const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);

    const params = {
      booking: [
        startDateParam,
        endDateParam,
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDateParam,
        endDateParam,
      ],
      eventsRepeat: [
        settings.db.repeatParam,
        endDateParam,
      ],
    };


    const urls = {
      booking:       settings.db.url + '/' + settings.db.booking 
                                     + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsCurrent.join('&'),
      eventsRepeat:  settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsRepeat.join('&'),
    };

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function(AllResponses){
        const bookingsResponse = AllResponses[0];
        const eventsCurrentResponse = AllResponses[1];
        const eventsRepeatResponse = AllResponses[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function([bookings, eventsCurrent, eventsRepeat]){

        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
        thisBooking.updateDOM();
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;

    thisBooking.booked = {};
    for(let item of bookings){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for(let item of eventsCurrent){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }
    
    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;
    
    for(let item of eventsRepeat){
      if(item.repeat == 'daily'){
        for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }      
    }
    thisBooking.updateDOM();
    thisBooking.rangeBackg();
  }

  makeBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);
    
    for(let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){

      if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }
      thisBooking.booked[date][hourBlock].push(table);
    }
  }
  
  rangeBackg(){
    const thisBooking = this;

    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    const hours = ['12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5'];

    const rangeBackground = document.querySelector('.range-background');
    rangeBackground.innerHTML = '';
    hours.forEach(hour => {
      const element = document.createElement('div');
      element.classList.add('range-div');
      element.setAttribute('id', hour);      
  
      rangeBackground.appendChild(element);
    });
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvainable = false;
    
    if(
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ){
      allAvainable = true;
    }

    for(let table of thisBooking.dom.tables){
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
      }

      if(
        !allAvainable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ){
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }     

    let pickedDate = thisBooking.datePicker.correctValue;
    console.log(thisBooking.booked[pickedDate]);
    
    thisBooking.rangeBackg();
    const rangeDivs = document.querySelectorAll('.range-div');
    rangeDivs.forEach(rangeDiv => {
      const hour = rangeDiv.id;  
      let status = 1;   
      if(thisBooking.booked[pickedDate][hour]) {
        status = Object.keys(thisBooking.booked[pickedDate][hour]).length;
      }
      console.log(status);
      switch(status) {
      case 1:
        rangeDiv.classList.add('range-green');
        break;
      case 2:
        rangeDiv.classList.add('range-yellow');
        break;
      default:
        rangeDiv.classList.add('range-red');
      }       
    });
  }


  selectTable(){
    const thisBooking = this;



    for(let table of thisBooking.dom.tables){
      table.addEventListener('click', function(){
        thisBooking.removeSelected();
        table.classList.toggle('selected');
      });
    }

    thisBooking.dom.hourPicker.addEventListener('updated', function(){
      thisBooking.removeSelected();
    });

    thisBooking.dom.datePicker.addEventListener('updated', function(){
      thisBooking.removeSelected();
    });

  }

  removeSelected(){
    const thisBooking = this;

    for(let table of thisBooking.dom.tables){
      table.classList.remove('selected');
    }   
  }

  sendBooked(){
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    const payload = {
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      table: null,
      duration: thisBooking.hoursAmount.value,
      ppl: thisBooking.peopleAmount.value,
      starters: [],
      phone: thisBooking.dom.phone.value,
      address: thisBooking.dom.address.value,
    };

    for(let starter of thisBooking.dom.starters){
      if(starter.checked == true){
        payload.starters.push(starter.value);
      }
    }

    const tableId = document.querySelector('.floor-plan .selected').getAttribute(settings.booking.tableIdAttribute);
    payload.table = parseInt(tableId);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };
    fetch(url, options)
      .then(function(response){
        return response.json();
      }).then(function(parsedResponse){
        console.log('parsedResponse', parsedResponse);
        thisBooking.makeBooked(payload.date, payload.hour , payload.table , payload.duration);
      });
  }

  render(element){
    const thisBooking = this;
    const generatedHTML = templates.bookingWidget();

    thisBooking.dom = {};

    thisBooking.dom.wrapper = element;

    thisBooking.dom.wrapper.innerHTML = generatedHTML;

    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);

    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);

    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);

    thisBooking.dom.phone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    thisBooking.dom.address = thisBooking.dom.wrapper.querySelector(select.booking.address);
    thisBooking.dom.starters = thisBooking.dom.wrapper.querySelectorAll(select.booking.starters);
    thisBooking.dom.submit =  thisBooking.dom.wrapper.querySelector(select.booking.submit);

  }
  
  initWidgets(){
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);

    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);
    
    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.updateDOM();
    });

    thisBooking.dom.submit.addEventListener('click', function(){
      event.preventDefault();
      thisBooking.sendBooked();
    });
  }
}

export default Booking;
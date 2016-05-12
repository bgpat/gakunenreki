var client = {
  id: '936506058015-3v6kqj9j6fntgij4609cdtg0i52fg15o.apps.googleusercontent.com',
  secret: 'sdhzijSLVOrtWL3J-LLMESLG'
};
var scopes = ['https://www.googleapis.com/auth/calendar'];
var holidayCalendar = 'ja.japanese#holiday@group.v.calendar.google.com';

$(document).on('load', function() {
  gapi.client.setApiKey(client.secret);
  gapi.auth.authorize({
    client_id: client.id,
    scope: scopes,
    immediate: true
  }, callbackOAuth);
});

$('.weekdays').hide();
var date = new Date();
var year = date.getFullYear();
$('.first-start').val(year + '-04-01');
$('.first-end').val(year + '-09-30');
$('.second-start').val(year + '-10-01');
$('.second-end').val(year + 1 + '-03-31');

$('.login').on('click', function() {
  gapi.auth.authorize({
    client_id: client.id,
    scope: scopes,
    immediate: false
  }, callbackOAuth);
});

$('.rest-tempolary-button').on('click', function() {
  $(this).before(
    $('<input>')
    .attr('type', 'date')
    .addClass('rest-tempolary')
    .val(year + '-04-01')
  );
});

$('.modified-button').on('click', function() {
  $(this).parent().before($('<td>').addClass('modified').append(
    $('<input>')
    .attr('type', 'date')
    .addClass('modified-date')
    .val(year + '-04-01')
  ).append($(this).siblings('.weekdays').clone().show()));
});

$('.exec').on('click', function() {
  var completed = 0;
  var total = 0;
  var push = [];
  this.disabled = true;
  getHolidays(function(holidays) {
    holidays = holidays.map(function(d) {
      return d.start.date;
    });
    var q = async.queue(function(task, callback) {
      createEvent(task.id, task.start, task.end, task.summary, task.description, callback);
    }, 5);
    var id = $('.list').val();
    var fstart = new Date($('.first-start').val());
    var fend = new Date($('.first-end').val());
    var sstart = new Date($('.second-start').val());
    var send = new Date($('.second-end').val());
    var summary = '';
    var description = '';
    var week = [0, 0, 0, 0, 0, 0, 0];
    for (var d = new Date(fstart); d <= send; d.setTime(d.getTime() + 24 * 60 * 60 * 1000)) {
      if (d.getTime() === sstart.getTime()) {
        week = [0, 0, 0, 0, 0, 0, 0];
      }
      var day = d.getDay();
      var name = $('.day-' + day).val();
      var holiday = ~holidays.indexOf(formatDate(d));
      if (
        (d <= fend || sstart <= d)
        && !($('.rest-holiday').val() && holiday)
        && $('.rest-saturday.day-' + day).prop('checked') !== true
        && $('.rest-sunday.day-' + day).prop('checked') !== true
        && !~$('.rest-tempolary').toArray().map(function(e) {
          return $(e).val();
        }).indexOf(formatDate(d))
      ) {
        var i;
        if ((i = $('.modified > .modified-date').toArray().map(function(d) {
          return $(d).val();
        }).indexOf(formatDate(d))) !== -1) {
          var e = $('.modified:eq(' + i + ') > .weekdays');
          name = e.val();
          day = e.children('[value=' + name + ']').attr('class').slice(-1);
        }
        summary = name + ++week[day];
        description = year + '年度 ' + (d < sstart ? '前期' : '後期') + name + '曜日 ' + week[day] + '回目';
        //console.log(formatDate(d), summary, description);
        //createEvent(id, formatDate(d), formatDate(d), summary, description);
        push[formatDate(d)] = function() {
          q.push({
            id: id,
            start: formatDate(d),
            end: formatDate(d),
            summary: summary,
            description: description
          }, function(err, d) {
            if (err != null) {
              setTimeout(push[d], Math.random() * 10000);
              console.error(err, d, q.length());
            } else {
              $('.exec').text('実行中(' + ++completed + ' / ' + total + ')');
              if (q.empty()) {
                $('.exec').prop('disabled', false).text('実行');
              }
            }
          });
        };
        push[formatDate(d)]();
        total++;
      }
    }
  });
});

function formatDate(date) {
  return [
    date.getFullYear(),
    ('0' + (date.getMonth() + 1)).slice(-2),
    ('0' + date.getDate()).slice(-2)
  ].join('-');
}

function callbackOAuth(oauth) {
  if (oauth == null || oauth.error) {
    return;
  }
  $('.login').hide();
  gapi.client.load('calendar', 'v3', getCalendarList);
}

function getCalendarList() {
  $('.list > option').text('ロード中');
  var req = gapi.client.calendar.calendarList.list();
  req.execute(function(res) {
    $('.list').empty().append(res.items.map(function(calendar){
      return $('<option>')
      .val(calendar.id)
      .text(calendar.summary)
      .attr({
        title: calendar.description,
        selected: calendar.primary
      });
    })).append($('<option>').on('click', function(){
      $(this).text('カレンダー作成中');
      createCalendar(
        prompt('カレンダー名', '学年暦'),
        prompt('カレンダーの説明', '学年暦')
      );
    }).text('新規カレンダー'));
    console.log(res);
  });
}

function createCalendar(summary, description) {
  var req = gapi.client.calendar.calendars.insert({
    summary: summary,
    description: description
  });
  req.execute(getCalendarList);
}

function createEvent(id, start, end, summary, description, callback) {
  var req = gapi.client.calendar.events.insert({
    calendarId: id,
    start: {
      date: start
    },
    end: {
      date: end
    },
    summary: summary,
    description: description,
    transparency: 'transparent'
  });
  req.execute(function(res) {
    var err = res.error;
    callback(err, err == null ? res : start);
  });
}

function getEvents(id, start, end, callback) {
  var req = gapi.client.calendar.events.list({
    calendarId: id,
    timeMin: to3339(new Date(start)),
    timeMax: to3339(new Date(end))
  });
  req.execute(callback);
}

function getHolidays(callback) {
  getEvents(holidayCalendar, $('.first-start').val(), $('.second-end').val(), function(res) {
    callback(res.items.sort(function(a, b) {
      return new Date(a.start.date) - new Date(b.start.date);
    }));
  });
}

function to3339(date) {
  return formatDate(date) + 'T' + [date.getHours(), date.getMinutes(), date.getSeconds(), date.getTimezoneOffset() / 60, date.getTimezoneOffset() % 60].map(function(n) {
    return ('0' + n).slice(-2);
  }).join(':').replace(/:(\+|-)?(\d?\d):(\d\d)$/, function(a, b, c, d) {
    return (b && '+') + ('0' + c).slice(-2) + ':' + d;
  });
}

package ug.trinityfamilyschool.photo;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
/** School-local calendar dates; all-day end dates include that entire day. */
final class SchoolEventSchedule {
    static final class Event {
        String id, title, location, classes = ""; long start, end, spotlight; boolean reminders, allDay;
        String token() { return id + "|" + start + "|" + end + "|" + title; }
    }
    static List<Event> events(JSONObject datasets, ZoneId zone) {
        List<Event> result = new ArrayList<>();
        JSONObject saved = datasets.optJSONObject("events"); JSONArray values = saved == null ? null : saved.optJSONArray("data");
        if (values == null) return result;
        Set<String> ids = new HashSet<>();
        for (int i=0;i<values.length();i++) try {
            JSONObject value = values.getJSONObject(i); String status = value.optString("status");
            if (status.equals("Draft") || status.equals("Cancelled") || status.equals("Completed") || value.optString("approvalStatus").equals("Rejected")
                || (value.optBoolean("requiresApproval") && !value.optString("approvalStatus").equals("Approved") && value.optString("approvedBy").isEmpty())) continue;
            Event event = new Event(); event.id=value.getString("id"); if (ids.contains(event.id)) continue;
            LocalDate date=LocalDate.parse(value.getString("startDate").substring(0,10));
            String endDate=value.optString("endDate");
            LocalDate last=endDate.isEmpty()?date:LocalDate.parse(endDate.substring(0,10));
            boolean all=value.optBoolean("isAllDay"); String startTime=value.optString("startTime");
            event.allDay=all;
            event.start=(all || startTime.isEmpty() ? date.atStartOfDay(zone) : date.atTime(LocalTime.parse(startTime)).atZone(zone)).toInstant().toEpochMilli();
            String endTime=value.optString("endTime");
            event.end=(all || endTime.isEmpty() ? last.plusDays(1).atStartOfDay(zone) : last.atTime(LocalTime.parse(endTime)).atZone(zone)).toInstant().toEpochMilli();
            if (event.end <= event.start) continue;
            event.spotlight=date.minusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
            event.title=value.optString("title", "School event"); event.location=value.optString("location");
            event.classes=examClasses(value,datasets);
            event.reminders=value.optBoolean("sendReminders",true); ids.add(event.id); result.add(event);
        } catch (Exception ignored) { /* One malformed event must not blank the rest. */ }
        result.sort(Comparator.comparingLong(e -> e.start)); return result;
    }
    static String examClasses(JSONObject event, JSONObject datasets) {
        if (!event.optBoolean("isExamEvent")) return "";
        LinkedHashSet<String> labels=new LinkedHashSet<>();
        JSONArray names=event.optJSONArray("classNames"), ids=event.optJSONArray("classIds");
        JSONObject saved=datasets.optJSONObject("classes"); JSONArray classes=saved==null?null:saved.optJSONArray("data");
        if (ids!=null && ids.length()>0) for(int i=0;i<ids.length();i++) {
            String id=ids.optString(i), label="";
            if(classes!=null) for(int j=0;j<classes.length();j++) {
                JSONObject item=classes.optJSONObject(j);
                if(item!=null && id.equals(item.optString("id"))) { label=item.optString("code"); if(label.trim().isEmpty()) label=item.optString("name"); break; }
            }
            if(label.trim().isEmpty() && names!=null) label=names.optString(i);
            if(label.trim().isEmpty()) label=id;
            if(!label.trim().isEmpty()) labels.add(label.trim());
        }
        else if(names!=null) for(int i=0;i<names.length();i++) { String label=names.optString(i).trim(); if(!label.isEmpty()) labels.add(label); }
        return labels.isEmpty()?"Classes not specified":"Classes: "+String.join(", ",labels);
    }
    static long reminderAt(Event event, ZoneId zone) { return Instant.ofEpochMilli(event.start).atZone(zone).minusDays(1).toInstant().toEpochMilli(); }
    static boolean reminderDue(Event event, long scheduled, long now, ZoneId zone) {
        return event.reminders && now >= scheduled && now-scheduled <= 15*60000L && now < event.end && (scheduled==event.start || scheduled==reminderAt(event,zone));
    }
    static boolean visible(Event event, long now, boolean enabled) { return now < event.end && (enabled || now >= event.spotlight); }
    static long boundary(List<Event> events, long now, long fallback) {
        long next=fallback;
        for(Event e:events) for(long at:new long[]{e.spotlight,e.start,e.end}) if(at>now) next=Math.min(next,at);
        return next;
    }
    static TimetableSchedule.Frame frame(Event event, ZonedDateTime now) {
        TimetableSchedule.Frame row=new TimetableSchedule.Frame(); long millis=now.toInstant().toEpochMilli();
        row.eventId=event.id; row.profileId="event:"+event.id; row.title=event.title; row.tableName="Events"; row.timeZone=now.getZone().getId();
        row.shortLabel=event.title; row.agenda=event.location; row.active=millis>=event.start; row.end=event.end;
        row.eventClasses=event.classes;
        row.next=row.active ? "Ongoing" : Instant.ofEpochMilli(event.start).atZone(now.getZone()).toLocalDate().equals(now.toLocalDate().plusDays(1)) ? "Tomorrow" : "Upcoming";
        DateTimeFormatter format=DateTimeFormatter.ofPattern("EEE d MMM, HH:mm");
        row.time=Instant.ofEpochMilli(event.start).atZone(now.getZone()).format(format)+" – "+Instant.ofEpochMilli(event.allDay ? event.end-1 : event.end).atZone(now.getZone()).format(format);
        return row;
    }
}

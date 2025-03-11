export const getEvents = async () => {
    return await fetch('https://api.externa.com/events').then(res => res.json());
};

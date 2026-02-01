import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
    en: {
        translation: {
            "welcome": "Welcome to PolyTask",
            "login": "Login",
            "signup": "Create an account",
            "email": "Email",
            "password": "Password",
            "loading": "Loading...",
            "myProjects": "My Projects",
            "newProject": "New Project",
            "createProject": "Create Project",
            "projectName": "Name",
            "projectDescription": "Description",
            "noProjectsYet": "No projects yet",
            "createFirstProject": "Create your first project to get started.",
            "tasks": "Tasks",
            "newTask": "New task title...",
            "typeComment": "Type a comment...",
            "send": "Send",
            "noComments": "No comments yet",
            "comments": "Comments"
        }
    },
    es: {
        translation: {
            "welcome": "Bienvenido a PolyTask",
            "login": "Iniciar sesión",
            "signup": "Crear una cuenta",
            "email": "Correo electrónico",
            "password": "Contraseña",
            "loading": "Cargando...",
            "myProjects": "Mis Proyectos",
            "newProject": "Nuevo Proyecto",
            "createProject": "Crear Proyecto",
            "projectName": "Nombre",
            "projectDescription": "Descripción",
            "noProjectsYet": "Aún no hay proyectos",
            "createFirstProject": "Crea tu primer proyecto para comenzar.",
            "tasks": "Tareas",
            "newTask": "Nuevo título de tarea...",
            "typeComment": "Escribe un comentario...",
            "send": "Enviar",
            "noComments": "Aún no hay comentarios",
            "comments": "Comentarios"
        }
    },
    hi: {
        translation: {
            "welcome": "PolyTask में आपका स्वागत है",
            "login": "लॉग इन करें",
            "signup": "खाता बनाएं",
            "email": "ईमेल",
            "password": "पासवर्ड",
            "loading": "लोड हो रहा है...",
            "myProjects": "मेरी परियोजनाएं",
            "newProject": "नई परियोजना",
            "createProject": "परियोजना बनाएं",
            "projectName": "नाम",
            "projectDescription": "विवरण",
            "noProjectsYet": "अभी तक कोई परियोजना नहीं",
            "createFirstProject": "शुरू करने के लिए अपनी पहली परियोजना बनाएं।",
            "tasks": "कार्य",
            "newTask": "नया कार्य शीर्षक...",
            "typeComment": "टिप्पणी लिखें...",
            "send": "भेजें",
            "noComments": "अभी तक कोई टिप्पणी नहीं",
            "comments": "टिप्पणियाँ"
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;

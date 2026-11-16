import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

export default function App() {
  const [telaAtual, setTelaAtual] = useState('welcome'); // 'welcome' | 'login' | 'cadastro' | 'home'
  const [abaHome, setAbaHome] = useState('inicio'); // 'inicio' | 'apoio' | 'profissionais' | 'mapa' | 'perfil'
  const [nome, setNome] = useState('');
  const [tipos, setTipos] = useState({
    TDAH: false,
    TEA: false,
    TOD: false,
    OUTROS: false,
  });
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTelaAtual('home');
      } else {
        setTelaAtual((prev) => (prev === 'home' ? 'welcome' : prev));
      }
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, []);

  const alternarTipo = (chave) => {
    setTipos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  // Função para fazer login com o Firebase
  const handleLogin = async () => {
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha o e-mail e a senha.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      setTelaAtual('home');
    } catch (error) {
      console.log('Erro no Login:', error.code, error.message);
      Alert.alert('Erro no Login', error.message);
    }
  };

  // Função para registrar nova conta no Firebase a partir da tela de Cadastro
  const handleRegister = async () => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!nomeLimpo || !emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha nome, e-mail e senha para se cadastrar.');
      return;
    }

    if (senhaLimpa.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      await updateProfile(userCredential.user, { displayName: nomeLimpo });

      const tiposSelecionados = Object.keys(tipos).filter((chave) => tipos[chave]);
      console.log('Conta criada:', userCredential.user.uid, 'Tipos:', tiposSelecionados);

      Alert.alert('Sucesso', 'Conta criada com sucesso!');
      setTelaAtual('home');
    } catch (error) {
      console.log('Erro ao criar conta:', error.code, error.message);
      Alert.alert('Erro ao criar conta', error.message);
    }
  };

  // Função para sair da conta (Logout real)
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setNome('');
      setTipos({ TDAH: false, TEA: false, TOD: false, OUTROS: false });
      setEmail('');
      setSenha('');
      setMostrarSenha(false);
      setAbaHome('inicio');
      setTelaAtual('welcome');
    } catch (error) {
      console.log('Erro ao sair:', error.message);
      Alert.alert('Erro', 'Não foi possível terminar a sessão.');
    }
  };

  // ==========================================
  // TELA 1: APRESENTAÇÃO / BOAS-VINDAS
  // ==========================================
  if (telaAtual === 'welcome') {
    return (
      <View style={styles.containerWelcome}>
        <View style={styles.imageContainer}>
          <Image
            source={require('./BEMVI_01.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.textContainerWelcome}>
          <Text style={styles.textoAcolhimento}>
            Plataforma de acolhimento, conexão e indicação para mães atípicas,
            criada para fortalecer redes de apoio, facilitar o acesso a profissionais e
            promover inclusão no dia a dia.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.btnSeta}
          onPress={() => setTelaAtual('login')}
        >
          <Ionicons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }

  // ==========================================
  // TELA 2: LOGIN COM FIREBASE
  // ==========================================
  if (telaAtual === 'login') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <View style={styles.loginContent}>
          <Text style={styles.loginTitle}>Bemvi</Text>
          <Text style={styles.loginSubtitle}>LOGIN — Entre para aceder à sua rede de apoio.</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o seu e-mail"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.inputSenhaWrapper}>
              <TextInput
                style={styles.inputSenha}
                placeholder="Digite a sua senha"
                placeholderTextColor="#888"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
              />
              <TouchableOpacity
                style={styles.btnOlho}
                onPress={() => setMostrarSenha(!mostrarSenha)}
              >
                <Ionicons
                  name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#3E5C5B"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.btnLogin}
            onPress={handleLogin}
          >
            <Text style={styles.btnLoginText}>ACESSAR</Text>
          </TouchableOpacity>

          <Text style={styles.textoPergunta}>PRIMEIRA VEZ?</Text>

          <TouchableOpacity
            style={styles.btnVerdeDestaque}
            onPress={() => {
              setMostrarSenha(false);
              setTelaAtual('cadastro');
            }}
          >
            <Text style={styles.btnVerdeDestaqueText}>CRIE SUA CONTA AQUI!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnVoltar}
            onPress={() => setTelaAtual('welcome')}
          >
            <Text style={styles.btnVoltarText}>← Voltar</Text>
          </TouchableOpacity>
        </View>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // TELA 2.5: CADASTRO
  // ==========================================
  if (telaAtual === 'cadastro') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <ScrollView contentContainerStyle={styles.scrollCadastro} showsVerticalScrollIndicator={false}>
          <View style={styles.loginContent}>
            <Text style={styles.loginTitle}>CADASTRO</Text>
            <Text style={styles.loginSubtitle}>Crie sua conta para fazer parte da comunidade.</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu nome completo"
                placeholderTextColor="#888"
                value={nome}
                onChangeText={setNome}
              />
            </View>

            <View style={styles.tiposContainer}>
              <Text style={styles.inputLabel}>TIPOS</Text>
              {['TDAH', 'TEA', 'TOD', 'OUTROS'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.checkboxLinha}
                  onPress={() => alternarTipo(item)}
                >
                  <View style={[styles.checkbox, tipos[item] && styles.checkboxAtivo]}>
                    {tipos[item] && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.textoCheckbox}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o seu e-mail"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={styles.inputSenhaWrapper}>
                <TextInput
                  style={styles.inputSenha}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#888"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!mostrarSenha}
                />
                <TouchableOpacity
                  style={styles.btnOlho}
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                >
                  <Ionicons
                    name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="#3E5C5B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnLogin}
              onPress={handleRegister}
            >
              <Text style={styles.btnLoginText}>CADASTRAR</Text>
            </TouchableOpacity>

            <Text style={styles.textoPergunta}>JÁ TEM CADASTRO?</Text>

            <TouchableOpacity
              style={styles.btnVerdeDestaque}
              onPress={() => {
                setMostrarSenha(false);
                setTelaAtual('login');
              }}
            >
              <Text style={styles.btnVerdeDestaqueText}>REALIZE LOGIN AQUI!</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // TELA 3: HOME / PAINEL PRINCIPAL
  // ==========================================
  return (
    <SafeAreaView style={styles.containerHome}>
      {/* Cabeçalho */}
      <View style={styles.headerHome}>
        <TouchableOpacity>
          <Ionicons name="menu-outline" size={28} color="#3E5C5B" />
        </TouchableOpacity>
        <Text style={styles.logoTextHome}>Bemvi</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.btnSairTopo}>
          <Ionicons name="log-out-outline" size={22} color="#B91C1C" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitleHome}>Você não está sozinha.</Text>

      {/* Área Central Rolável */}
      <ScrollView
        style={styles.scrollHome}
        contentContainerStyle={styles.contentHome}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.mainButton, styles.btnBlue]}
          onPress={() => setAbaHome('apoio')}
        >
          <Ionicons name="heart-outline" size={20} color="#222" style={styles.btnIcon} />
          <Text style={styles.buttonText}>PRECISO CONVERSAR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainButton, styles.btnGreen]}
          onPress={() => setAbaHome('profissionais')}
        >
          <Ionicons name="medkit-outline" size={20} color="#222" style={styles.btnIcon} />
          <Text style={styles.buttonText}>ENCONTRAR PROFISSIONAIS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainButton, styles.btnYellow]}
          onPress={() => setAbaHome('mapa')}
        >
          <Ionicons name="location-outline" size={20} color="#222" style={styles.btnIcon} />
          <Text style={styles.buttonText}>MAPA INCLUSIVO</Text>
        </TouchableOpacity>

        <View style={styles.quickAccessContainer}>
          <Text style={styles.quickAccessTitle}>ACESSO RÁPIDO</Text>
          <View style={styles.cardRow}>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="bookmark-outline" size={22} color="#3E5C5B" />
              <Text style={styles.cardLabel}>Favoritos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="calendar-outline" size={22} color="#3E5C5B" />
              <Text style={styles.cardLabel}>Agenda</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="book-outline" size={22} color="#3E5C5B" />
              <Text style={styles.cardLabel}>Guias</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Barra de Ícones Fixa no Fim da Tela: Início, Apoio, Profissionais, Mapa e Perfil */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('inicio')}
        >
          <Ionicons
            name={abaHome === 'inicio' ? 'home' : 'home-outline'}
            size={22}
            color={abaHome === 'inicio' ? '#2E7D32' : '#555'}
          />
          <Text style={[styles.tabText, abaHome === 'inicio' && styles.tabTextAtivo]}>
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('apoio')}
        >
          <Ionicons
            name={abaHome === 'apoio' ? 'heart' : 'heart-outline'}
            size={22}
            color={abaHome === 'apoio' ? '#2E7D32' : '#555'}
          />
          <Text style={[styles.tabText, abaHome === 'apoio' && styles.tabTextAtivo]}>
            Apoio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('profissionais')}
        >
          <Ionicons
            name={abaHome === 'profissionais' ? 'medkit' : 'medkit-outline'}
            size={22}
            color={abaHome === 'profissionais' ? '#2E7D32' : '#555'}
          />
          <Text style={[styles.tabText, abaHome === 'profissionais' && styles.tabTextAtivo]}>
            Profissionais
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('mapa')}
        >
          <Ionicons
            name={abaHome === 'mapa' ? 'map' : 'map-outline'}
            size={22}
            color={abaHome === 'mapa' ? '#2E7D32' : '#555'}
          />
          <Text style={[styles.tabText, abaHome === 'mapa' && styles.tabTextAtivo]}>
            Mapa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('perfil')}
        >
          <Ionicons
            name={abaHome === 'perfil' ? 'person' : 'person-outline'}
            size={22}
            color={abaHome === 'perfil' ? '#2E7D32' : '#555'}
          />
          <Text style={[styles.tabText, abaHome === 'perfil' && styles.tabTextAtivo]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWelcome: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  imageContainer: {
    alignItems: 'center',
  },

  logo: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
  },

  textContainerWelcome: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
  },

  textoAcolhimento: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3E5C5B',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.5,
  },

  btnSeta: {
    backgroundColor: '#000',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  containerLogin: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  scrollCadastro: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  loginContent: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },

  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E5C5B',
    marginBottom: 8,
  },

  loginSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },

  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E5C5B',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },

  inputSenhaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
  },

  inputSenha: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },

  btnOlho: {
    paddingHorizontal: 14,
  },

  tiposContainer: {
    marginBottom: 16,
    width: '100%',
  },

  checkboxLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 4,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#3E5C5B',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  checkboxAtivo: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },

  textoCheckbox: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },

  btnLogin: {
    backgroundColor: '#3E5C5B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },

  btnLoginText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },

  textoPergunta: {
    textAlign: 'center',
    color: '#3E5C5B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 8,
  },

  btnVerdeDestaque: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  btnVerdeDestaqueText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  btnVoltar: {
    alignItems: 'center',
    marginTop: 14,
  },

  btnVoltarText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },

  // ==========================================
  // ESTILOS DA HOME COM RODAPÉ FIXO
  // ==========================================
  containerHome: {
    flex: 1,
    backgroundColor: '#F5F5DC',
  },

  headerHome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 45 : 15,
    paddingBottom: 5,
  },

  btnSairTopo: {
    padding: 4,
  },

  logoTextHome: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E5C5B',
  },

  subtitleHome: {
    textAlign: 'center',
    fontSize: 14,
    color: '#444',
    marginBottom: 20,
  },

  scrollHome: {
    flex: 1,
  },

  contentHome: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },

  mainButton: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  btnIcon: {
    marginRight: 8,
  },

  btnBlue: {
    backgroundColor: '#7A9AAB',
  },

  btnGreen: {
    backgroundColor: '#5CD662',
  },

  btnYellow: {
    backgroundColor: '#F3C562',
  },

  buttonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  quickAccessContainer: {
    width: '100%',
    marginTop: 15,
  },

  quickAccessTitle: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
    fontWeight: '600',
  },

  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  card: {
    width: '31%',
    height: 80,
    backgroundColor: '#DDD7CC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardLabel: {
    fontSize: 12,
    color: '#3E5C5B',
    fontWeight: '600',
    marginTop: 6,
  },

  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#EAE5DB',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 14 : 10,
    borderTopWidth: 1,
    borderTopColor: '#D8D2C6',
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  tabText: {
    fontSize: 11,
    color: '#555',
    marginTop: 3,
  },

  tabTextAtivo: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});
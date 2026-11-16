import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { auth } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [telaAtual, setTelaAtual] = useState('welcome');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [initializing, setInitializing] = useState(true);

  // Opcional recomendado: Monitorar o estado de autenticação do Firebase automaticamente
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTelaAtual('home');
      } else {
        // Se não houver usuário logado e ele estiver na home, joga para a welcome ou login
        if (telaAtual === 'home') {
          setTelaAtual('welcome');
        }
      }
      if (initializing) setInitializing(false);
    });
    return subscriber; // Desinscreve ao desmontar
  }, []);

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
      // O onAuthStateChanged já vai alternar para 'home' automaticamente se configurado, 
      // mas mantemos aqui para garantir transição imediata:
      setTelaAtual('home'); 
    } catch (error) {
      console.log('Erro no Login:', error.code, error.message);
      Alert.alert('Erro no Login', error.message);
    }
  };

  // Função para registar nova conta no Firebase
  const handleRegister = async () => {
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha o e-mail e a senha para se registar.');
      return;
    }

    if (senhaLimpa.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      console.log('Conta criada:', userCredential.user);
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
      setEmail('');
      setSenha('');
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
          <Text style={styles.setaTexto}>➔</Text>
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
          <Text style={styles.loginTitle}>Bem-vinda de volta</Text>
          <Text style={styles.loginSubtitle}>Entre para aceder à sua rede de apoio.</Text>

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
            <TextInput 
              style={styles.input}
              placeholder="Digite a sua senha (mínimo 6 caracteres)"
              placeholderTextColor="#888"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />
          </View>

          {/* Botão de Entrar via Firebase */}
          <TouchableOpacity 
            style={styles.btnLogin}
            onPress={handleLogin}
          >
            <Text style={styles.btnLoginText}>ENTRAR</Text>
          </TouchableOpacity>

          {/* Botão de Registar nova conta */}
          <TouchableOpacity 
            style={styles.btnRegister}
            onPress={handleRegister}
          >
            <Text style={styles.btnRegisterText}>Criar nova conta</Text>
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
  // TELA 3: HOME / PAINEL PRINCIPAL
  // ==========================================
  return (
    <View style={styles.containerHome}>
      <View style={styles.headerHome}>
        <Text style={styles.iconeHeader}>☰</Text>
        <Text style={styles.logoTextHome}>Bemvi</Text>
        <Text style={styles.iconeHeader}>🔔</Text>
      </View>

      <Text style={styles.subtitleHome}>Você não está sozinha.</Text>

      <ScrollView contentContainerStyle={styles.contentHome}>
        <TouchableOpacity style={[styles.mainButton, styles.btnBlue]}>
          <Text style={styles.buttonText}>PRECISO CONVERSAR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainButton, styles.btnGreen]}>
          <Text style={styles.buttonText}>ENCONTRAR PROFISSIONAIS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainButton, styles.btnYellow]}>
          <Text style={styles.buttonText}>MAPA INCLUSIVO</Text>
        </TouchableOpacity>

        <View style={styles.quickAccessContainer}>
          <Text style={styles.quickAccessTitle}>ACESSO RÁPIDO</Text>
          <View style={styles.cardRow}>
            <View style={styles.card} />
            <View style={styles.card} />
            <View style={styles.card} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTelaAtual('home')}>
          <Text style={styles.tabIcone}>🏠</Text>
          <Text style={[styles.tabText, { color: '#2E7D32', fontWeight: 'bold' }]}>Início</Text>
        </TouchableOpacity>

        {/* Botão Sair corrigido para chamar o signOut do Firebase */}
        <TouchableOpacity style={styles.tabItem} onPress={handleLogout}>
          <Text style={styles.tabIcone}>🚪</Text>
          <Text style={styles.tabText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
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
    alignItems: 'center' 
  },
  
  logo: { 
    width: 280, 
    height: 280, 
    resizeMode: 'contain' 
  },
  
  textContainerWelcome: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    maxWidth: 600, 
    width: '100%' 
  },

  textoAcolhimento: { 
    fontSize: 18, 
    fontWeight: '500', 
    color: '#3E5C5B', 
    textAlign: 'center', 
    lineHeight: 28, 
    letterSpacing: 0.5 
  },

  btnSeta: { 
    backgroundColor: '#000', 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  setaTexto: {
     color: '#FFF', 
     fontSize: 22, 
     fontWeight: 'bold' 
  },

  containerLogin: {
     flex: 1, 
     backgroundColor: '#F5F5DC', 
     justifyContent: 'center', 
     paddingHorizontal: 24 
  },
  
  loginContent: { 
    width: '100%', 
    maxWidth: 400, 
    alignSelf: 'center' 
  },
  
  loginTitle: {
     fontSize: 28, 
     fontWeight: 'bold', 
     color: '#3E5C5B', 
     marginBottom: 8 
  },

  loginSubtitle: { 
    fontSize: 14, 
    color: '#666', 
    marginBottom: 30 
  },

  inputContainer: {
     marginBottom: 20, 
     width: '100%' 
  },
  
  inputLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#3E5C5B', 
    marginBottom: 6 
  },
  
  input: { 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#D8D2C6', 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    color: '#333' 
  },
  
  btnLogin: { 
    backgroundColor: '#3E5C5B', 
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 10 
  },
  
  btnLoginText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 16, 
    letterSpacing: 1 
  },
  
  btnRegister: { 
    alignItems: 'center', 
    marginTop: 15 
  },

  btnRegisterText: { 
    color: '#3E5C5B', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  
  btnVoltar: { 
    alignItems: 'center', 
    marginTop: 10 
  },

  btnVoltarText: { 
    color: '#666', 
    fontSize: 14, 
    fontWeight: '600' 
  },

  containerHome: { 
    flex: 1, 
    backgroundColor: '#F5F5DC' 
  },

  headerHome: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 50, 
    paddingBottom: 5 
  },

  iconeHeader: { 
    fontSize: 22 
  },

  logoTextHome: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#222' 
  },

  subtitleHome: { 
    textAlign: 'center', 
    fontSize: 14, 
    color: '#444', 
    marginBottom: 25 
  },

  contentHome: { 
    paddingHorizontal: 20, 
    alignItems: 'center' 
  },

  mainButton: { 
    width: '100%', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginBottom: 15 
  },

  btnBlue: { 
    backgroundColor: '#7A9AAB' 
  },

  btnGreen: { 
    backgroundColor: '#5CD662' 
  },

  btnYellow: { 
    backgroundColor: '#F3C562' 
  },

  buttonText: { 
    color: '#222', 
    fontWeight: 'bold', 
    fontSize: 14, 
    letterSpacing: 0.5 
  },

  quickAccessContainer: { 
    width: '100%', 
    marginTop: 15 
  },

  quickAccessTitle: { 
    fontSize: 12, 
    color: '#555', 
    marginBottom: 10, 
    fontWeight: '600' 
  },

  cardRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },

  card: { 
    width: '31%', 
    height: 80, 
    backgroundColor: '#DDD7CC', 
    borderRadius: 12 
  },

  tabBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    backgroundColor: '#EAE5DB', 
    paddingVertical: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#D8D2C6' 
  },

  tabItem: { 
    alignItems: 'center' 
  },
  
  tabIcone: { 
    fontSize: 18 
  },
  
  tabText: { 
    fontSize: 11, 
    color: '#666', 
    marginTop: 2 
  }
});